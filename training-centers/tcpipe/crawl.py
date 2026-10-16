"""Crawl hàng loạt website trung tâm (GĐ2): nhiều site song song, mỗi domain vẫn ≥ min_delay giây/request.

Đầu vào: danh sách {url, province_hint?, brand_hint?, discovered_from}. Mỗi site ghi một bản ghi `website`
vào source_records (thay bản ghi cũ cùng URL) và một dòng source_log.
"""
from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

from rapidfuzz import fuzz

from . import db
from .http import PoliteClient
from .normalize import fold, website_domain
from .probe import _outcome_of_error
from .sources import websites

log = logging.getLogger(__name__)

FREE_MAIL = {
    "gmail.com", "gmail.com.vn", "yahoo.com", "yahoo.com.vn", "ymail.com", "hotmail.com", "outlook.com",
    "outlook.com.vn", "live.com", "msn.com", "icloud.com", "me.com", "aol.com", "mail.ru", "qq.com", "163.com",
    "126.com", "naver.com", "daum.net", "protonmail.com", "proton.me", "zoho.com", "yandex.com", "fpt.vn",
    "vnn.vn", "hn.vnn.vn", "hcm.vnn.vn", "vnpt.vn",
}


def email_domain(email: str | None) -> str | None:
    """Domain của email tổ chức. Bỏ email miễn phí và domain cơ quan nhà nước (.gov.vn)."""
    if not email or "@" not in email:
        return None
    d = email.rsplit("@", 1)[1].strip().lower().rstrip(".")
    if d in FREE_MAIL or d.endswith(".gov.vn") or "." not in d:
        return None
    return d


def domain_matches_brand(domain: str, brand_key: str, threshold: int = 70) -> bool:
    """Domain có giống tên thương hiệu không (tránh gộp theo domain dùng chung như <tỉnh>.edu.vn)."""
    label = domain.split(".")[0].replace("-", "")
    key = fold(brand_key).replace(" ", "")
    if len(label) < 3 or len(key) < 3:
        return False
    return fuzz.partial_ratio(label, key) >= threshold


def sgd_site_candidates(conn) -> list[dict]:
    """Website ứng viên từ email tổ chức trong danh sách Sở (chỉ khi domain giống tên trung tâm)."""
    from .build import brand_key

    out: dict[str, dict] = {}
    for row in conn.execute("SELECT province, source_url, payload FROM source_records WHERE source='sgd'"):
        p = json.loads(row["payload"])
        if not p.get("in_scope", True):
            continue
        for field in ("email", "other_contact"):
            for token in str(p.get(field) or "").replace(";", " ").replace(",", " ").split():
                d = email_domain(token.strip("()<>[]"))
                if d and domain_matches_brand(d, brand_key(p["center_name"], row["province"])):
                    out.setdefault(d, {"url": f"https://{d}/", "province_hint": row["province"],
                                       "brand_hint": p["center_name"],
                                       "discovered_from": f"email trong danh sách Sở: {row['source_url']}"})
        site = website_domain(p.get("extra", {}).get("website"))
        if site:
            out.setdefault(site, {"url": f"https://{site}/", "province_hint": row["province"],
                                  "brand_hint": p["center_name"],
                                  "discovered_from": f"website trong danh sách Sở: {row['source_url']}"})
    return list(out.values())


def _store(conn, entry: dict, r: websites.SiteResult) -> None:
    url = entry["url"]
    conn.execute("DELETE FROM source_records WHERE source='website' AND json_extract(payload, '$.url') = ?", (url,))
    conn.execute("DELETE FROM source_log WHERE source='website' AND url = ?", (url,))
    d = asdict(r)
    d["claims"] = [asdict(c) for c in r.claims][:10]
    d.update({k: entry.get(k) for k in ("province_hint", "brand_hint", "category_hint", "discovered_from")})
    prov = entry.get("province_hint")
    if r.alive:
        db.add_source_record(conn, "website", prov, r.final_url or url, d)
        db.log_source(conn, prov, "website", url, "ok", len(r.pages), entry.get("discovered_from"))
    else:
        err = "; ".join(r.errors) or ("domain bị park" if r.parked else "")
        db.log_source(conn, prov, "website", url, _outcome_of_error(err), 0, err[:500])
    conn.commit()


def crawl_sites(cfg, entries: list[dict], workers: int = 6, skip_done: bool = True) -> dict:
    conn = db.connect(cfg.path("db"))
    done = set()
    if skip_done:
        done = {r[0] for r in conn.execute("SELECT url FROM source_log WHERE source='website'")}
    seen, todo = set(), []
    for e in entries:
        d = website_domain(e["url"])
        if d and d not in seen and e["url"] not in done:
            seen.add(d)
            todo.append(e)
    client = PoliteClient.from_config(cfg)
    max_pages = cfg["crawl"]["max_pages_per_site"]
    stats = {"total": len(todo), "ok": 0, "failed": 0}
    try:
        with ThreadPoolExecutor(workers) as ex:
            futures = {ex.submit(websites.crawl_site, client, e["url"], cfg["categories"], max_pages): e for e in todo}
            for i, fut in enumerate(as_completed(futures), 1):
                e = futures[fut]
                try:
                    r = fut.result()
                except Exception as err:      # lỗi bất ngờ của một site không dừng cả lượt
                    log.exception("crawl %s lỗi", e["url"])
                    r = websites.SiteResult(url=e["url"], alive=False, errors=[f"{type(err).__name__}: {err}"])
                _store(conn, e, r)
                stats["ok" if r.alive else "failed"] += 1
                log.info("website %d/%d %s → %s", i, len(todo), e["url"], "ok" if r.alive else r.errors[:1])
    finally:
        client.close()
        conn.close()
    return stats
