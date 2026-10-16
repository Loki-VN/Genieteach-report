"""Nguồn 3: Google Places API (New) — Text Search + Place Details. Không scrape Google Maps.

Tính phí theo field mask (bậc cao nhất của field được yêu cầu):
  ids_only    : places.id                                   → Text Search Essentials (IDs Only), miễn phí
  pro         : + tên, địa chỉ, toạ độ, types, businessStatus → Text Search Pro
  enterprise  : + điện thoại, website, rating, userRatingCount → Text Search Enterprise

Điều khoản lưu trữ: place_id được lưu lâu dài; nội dung khác chỉ cache tạm trong bảng
places_cache và bị xóa sau google_places.content_cache_days ngày.
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Iterator

import httpx

from .. import db

log = logging.getLogger(__name__)

BASE = "https://places.googleapis.com/v1"

_PRO = ["id", "displayName", "formattedAddress", "location", "types", "primaryType",
        "businessStatus", "googleMapsUri"]
_ENTERPRISE = _PRO + ["nationalPhoneNumber", "internationalPhoneNumber", "websiteUri",
                      "rating", "userRatingCount"]
FIELDS = {"ids_only": ["id"], "pro": _PRO, "enterprise": _ENTERPRISE}


def search_mask(tier: str) -> str:
    return ",".join([f"places.{f}" for f in FIELDS[tier]] + ["nextPageToken"])


def details_mask(tier: str) -> str:
    return ",".join(FIELDS[tier])


class BudgetExceeded(RuntimeError):
    pass


class CostMeter:
    """Đếm request theo SKU (bảng api_usage) và chặn khi vượt ngân sách tháng."""

    def __init__(self, conn: sqlite3.Connection | None, pricing: dict, monthly_budget_usd: float):
        self.conn = conn
        self.pricing = pricing
        self.budget = monthly_budget_usd
        self._mem: dict[str, int] = {}

    def usage(self) -> dict[str, int]:
        return db.usage_this_month(self.conn) if self.conn else dict(self._mem)

    def cost(self, usage: dict[str, int] | None = None) -> float:
        return estimate_cost(usage if usage is not None else self.usage(), self.pricing)

    def charge(self, sku: str) -> None:
        usage = self.usage()
        usage[sku] = usage.get(sku, 0) + 1
        if self.cost(usage) > self.budget:
            raise BudgetExceeded(f"Vượt ngân sách {self.budget} USD/tháng (SKU {sku})")
        if self.conn:
            db.bump_usage(self.conn, sku)
        else:
            self._mem[sku] = usage[sku]


def estimate_cost(usage: dict[str, int], pricing: dict) -> float:
    total = 0.0
    for sku, n in usage.items():
        p = pricing[sku]
        free = p["free_per_month"]
        billable = 0 if free is None else max(0, n - free)
        total += billable * p["usd_per_1000"] / 1000
    return round(total, 2)


@dataclass
class PlacesClient:
    api_key: str
    meter: CostMeter
    conn: sqlite3.Connection | None = None
    language_code: str = "vi"
    region_code: str = "VN"
    page_size: int = 20
    max_pages: int = 3
    cache_days: int = 30
    min_interval: float = 0.2
    transport: httpx.BaseTransport | None = None

    def __post_init__(self):
        self.http = httpx.Client(timeout=30, transport=self.transport)
        self._last = 0.0

    @classmethod
    def from_config(cls, cfg, conn: sqlite3.Connection | None, **kw) -> "PlacesClient":
        g = cfg["google_places"]
        key = cfg.places_api_key
        if not key:
            raise RuntimeError("Thiếu GOOGLE_PLACES_API_KEY (đặt trong .env hoặc biến môi trường)")
        return cls(key, CostMeter(conn, g["pricing"], g["monthly_budget_usd"]), conn,
                   g["language_code"], g["region_code"], g["page_size"], g["max_pages"],
                   g["content_cache_days"], **kw)

    def _post(self, url: str, body: dict, mask: str, sku: str) -> dict:
        return self._call("POST", url, mask, sku, json=body)

    def _call(self, method: str, url: str, mask: str, sku: str, **kw) -> dict:
        self.meter.charge(sku)
        wait = self.min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        headers = {"X-Goog-Api-Key": self.api_key, "X-Goog-FieldMask": mask}
        for attempt in range(4):
            self._last = time.monotonic()
            r = self.http.request(method, url, headers=headers, **kw)
            if r.status_code in (429, 500, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            if r.status_code != 200:
                raise RuntimeError(f"Places API {r.status_code}: {r.text[:300]}")
            return r.json()
        raise RuntimeError("Places API: hết lượt thử lại")

    def search_text(self, query: str, tier: str = "pro", included_type: str | None = None,
                    location_restriction: dict | None = None) -> Iterator[dict]:
        """Duyệt mọi trang kết quả (tối đa max_pages × page_size)."""
        body: dict = {"textQuery": query, "languageCode": self.language_code,
                      "regionCode": self.region_code, "pageSize": self.page_size}
        if included_type:
            body["includedType"] = included_type
        if location_restriction:
            body["locationRestriction"] = location_restriction
        sku = f"text_search_{tier}"
        for _ in range(self.max_pages):
            data = self._post(f"{BASE}/places:searchText", body, search_mask(tier), sku)
            for place in data.get("places", []):
                self._cache(place)
                yield place
            token = data.get("nextPageToken")
            if not token:
                break
            body = {**body, "pageToken": token}

    def details(self, place_id: str, tier: str = "enterprise") -> dict:
        sku = f"place_details_{'essentials' if tier == 'ids_only' else tier}"
        place = self._call("GET", f"{BASE}/places/{place_id}?languageCode={self.language_code}",
                           details_mask(tier), sku)
        self._cache(place)
        return place

    def _cache(self, place: dict) -> None:
        if not self.conn or set(place) <= {"id"}:
            return
        now = datetime.now(timezone.utc).replace(microsecond=0)
        self.conn.execute(
            "INSERT INTO places_cache(place_id, payload, fetched_at, expires_at) VALUES (?,?,?,?) "
            "ON CONFLICT(place_id) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at, "
            "expires_at=excluded.expires_at",
            (place["id"], json.dumps(place, ensure_ascii=False), now.isoformat(),
             (now + timedelta(days=self.cache_days)).isoformat()),
        )
        self.conn.commit()


# ---------------------------------------------------------------------------
# Kế hoạch quét & ước tính chi phí (không gọi API)
# ---------------------------------------------------------------------------
def sweep_queries(categories: dict, rural_queries: list[str], province_name: str,
                  wards: list[tuple[str, bool]]) -> list[str]:
    """textQuery cho 1 tỉnh: cấp tỉnh + đủ bộ truy vấn cho từng phường + rural_queries cho từng xã."""
    full = [q for c in categories.values() for q in c.get("places_queries", [])]
    out = [f"{q} {province_name}" for q in full]
    for ward_name, is_urban in wards:
        for q in (full if is_urban else rural_queries):
            out.append(f"{q} {ward_name} {province_name}")
    return out


def estimate_sweep(categories: dict, sweep: dict, province_wards: dict[str, list[tuple[str, bool]]]) -> dict:
    full = sum(len(c.get("places_queries", [])) for c in categories.values())
    core = len(sweep["rural_queries"])
    urban = sum(1 for wards in province_wards.values() for _, u in wards if u)
    rural = sum(1 for wards in province_wards.values() for _, u in wards if not u)
    n_prov = len(province_wards)
    queries = (n_prov + urban) * full + rural * core
    requests = round((n_prov + urban) * full * sweep["avg_pages_urban"] + rural * core * sweep["avg_pages_rural"])
    return {"provinces": n_prov, "urban_units": urban, "rural_units": rural, "queries_per_urban_unit": full,
            "queries_per_rural_unit": core, "queries": queries, "requests": requests}
