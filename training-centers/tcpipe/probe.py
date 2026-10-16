"""GĐ0 — khảo sát từng nguồn cho một tỉnh (không crawl hàng loạt).

Kết quả: reports/gd0/<mã tỉnh>/probe.json + summary.md
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from dataclasses import asdict
from datetime import date
from pathlib import Path

from . import db
from .admin_units import Province, normalize_address
from .classify import classify_subjects
from .http import PoliteClient
from .normalize import website_domain
from .sources import business_registry, google_places, sgd, websites

log = logging.getLogger(__name__)


def probe_sgd(client: PoliteClient, cfg, prov: Province) -> dict:
    sources = cfg["sgd_sources"].get(prov.code, [])
    if not sources:
        return {"note": "Chưa có URL nguồn Sở cho tỉnh này trong config.yaml → sgd_sources"}
    out = {"sources": []}
    records = []
    for s in sources:
        res = sgd.probe_source(client, s["url"], prov.code, s.get("issuer") or f"Sở GD&ĐT {prov.short_name}",
                               follow=s.get("follow", 10))
        for rec in res.pop("_records"):
            as_of = s.get("as_of")
            if as_of == "live":         # danh bạ trực tuyến: tình trạng tại ngày đọc
                as_of = date.today().isoformat()
            rec.extra.update({"list_page": s["url"], "list_kind": s.get("kind"), "as_of": as_of,
                              "old_province": s.get("old_province")})
            records.append(rec)
        res["kind"] = s.get("kind")
        out["sources"].append(res)
    norm = [normalize_address(r.address_raw, prov.name) for r in records if r.address_raw]
    out["total_records"] = len(records)
    out["address_normalization"] = dict(Counter(n.confidence for n in norm))
    out["_records"] = records
    return out


def probe_registry(client: PoliteClient, cfg) -> dict:
    return {"portals": [business_registry.probe_portal(client, p["base_url"]) | {"name": p["name"]}
                        for p in cfg["business_registry"]["portals"]]}


def probe_places(cfg, conn, prov: Province, tier: str, n_queries: int) -> dict:
    if not cfg.places_api_key:
        return {"skipped": "Thiếu GOOGLE_PLACES_API_KEY"}
    client = google_places.PlacesClient.from_config(cfg, conn)
    queries = [q for c in cfg["categories"].values() for q in c["places_queries"][:1]][:n_queries]
    places: dict[str, dict] = {}
    per_query = {}
    for q in queries:
        text = f"{q} {prov.short_name}"
        found = list(client.search_text(text, tier=tier))
        per_query[text] = len(found)
        for p in found:
            places.setdefault(p["id"], p)
    vals = list(places.values())
    n = len(vals) or 1
    relevant = [p for p in vals
                if classify_subjects((p.get("displayName") or {}).get("text", ""), cfg["categories"])[0] != "khac"]
    return {
        "tier": tier, "queries": per_query, "unique_places": len(vals),
        "relevant_by_name": len(relevant),
        "business_status": dict(Counter(p.get("businessStatus", "N/A") for p in vals)),
        "primary_type": dict(Counter(p.get("primaryType", "N/A") for p in vals).most_common(10)),
        "with_website": round(sum(1 for p in vals if p.get("websiteUri")) / n, 2),
        "with_phone": round(sum(1 for p in vals if p.get("nationalPhoneNumber")) / n, 2),
        "rating_count_quartiles": _quartiles([p.get("userRatingCount", 0) for p in vals]),
        "usage_this_month": client.meter.usage(), "estimated_cost_usd": client.meter.cost(),
        "_websites": [p["websiteUri"] for p in relevant if website_domain(p.get("websiteUri"))],
    }


def _quartiles(values: list[int]) -> list[int] | None:
    v = sorted(values)
    if not v:
        return None
    return [v[int((len(v) - 1) * q)] for q in (0, 0.25, 0.5, 0.75, 1)]


def probe_websites(client: PoliteClient, cfg, urls: list[str], limit: int) -> dict:
    sites = []
    for url in list(dict.fromkeys(urls))[:limit]:
        r = websites.crawl_site(client, url, cfg["categories"], cfg["crawl"]["max_pages_per_site"])
        d = asdict(r)
        d["claims"] = [asdict(c) for c in r.claims][:10]
        sites.append(d)
    n = len(sites) or 1
    fill = {k: round(sum(1 for s in sites if s[k]) / n, 2)
            for k in ("phones", "emails", "fanpage_urls", "branch_addresses", "persons", "claims",
                      "founded_year", "last_activity_date")}
    return {"sites": sites, "alive": sum(1 for s in sites if s["alive"]), "parked": sum(1 for s in sites if s["parked"]),
            "fill_rate": fill}


def _outcome_of_error(err: str) -> str:
    if "BlockedError" in err:
        return "blocked"
    if "robots.txt không cho phép" in err:
        return "robots_disallow"
    return "unreachable"


RECORD_SOURCE = {"sgd": "sgd", "registry": "registry", "websites": "website", "places": "places"}


def _store(conn, source: str, prov: Province, r: dict) -> None:
    """Lưu bản ghi thô + nhật ký URL của một nguồn vào DB (thay lần chạy trước).

    Lần chạy không lấy được bản ghi nào (mạng lỗi, bị chặn) chỉ thay nhật ký, giữ bản ghi cũ.
    """
    if source == "sgd" and not r.get("total_records"):
        conn.execute("DELETE FROM source_log WHERE source IN ('sgd', 'sgd_file') AND province IS ?", (prov.code,))
    else:
        db.replace_source_records(conn, RECORD_SOURCE[source], prov.code)
    if source == "sgd":
        for rec in r.pop("_records", []):
            db.add_source_record(conn, "sgd", prov.code, rec.source_url, asdict(rec))
        for src in r.get("sources", []):
            err = "; ".join(src["errors"])
            outcome = _outcome_of_error(err) if src["errors"] and not src["records"] else (
                "ok" if src["records"] else "no_data")
            db.log_source(conn, prov.code, "sgd", src["url"], outcome, src["records"], err or None)
            for page in src.get("pages", []):
                if page["url"] != src["url"]:
                    db.log_source(conn, prov.code, "sgd_file", page["url"], "ok" if page["tables"] else "no_data",
                                  None, f"{page['format']} {'; '.join(page['notes'])}".strip())
    elif source == "registry":
        for p in r.get("portals", []):
            outcome = "blocked" if p.get("blocked") else ("ok" if p.get("home_allowed") else "robots_disallow"
                                                           if p.get("robots") == "ok" else "unreachable")
            db.log_source(conn, prov.code, "registry", p["base_url"], outcome, None,
                          f"robots={p['robots']}; captcha={p['captcha_on_page']}; điều khoản={p['terms_links'][:3]}")
    elif source == "websites":
        for site in r.get("sites", []):
            url = site.get("final_url") or site["url"]
            if site["alive"]:
                db.add_source_record(conn, "website", prov.code, url, site)
                db.log_source(conn, prov.code, "website", site["url"], "ok", len(site["pages"]))
            else:
                err = "; ".join(site["errors"]) or ("domain bị park" if site["parked"] else "")
                db.log_source(conn, prov.code, "website", site["url"], _outcome_of_error(err), 0, err)
    conn.commit()


def run_probe(cfg, prov: Province, sources: list[str], *, site_urls: list[str], site_limit: int,
              places_tier: str, places_queries: int) -> Path:
    out_dir = cfg.path("reports") / "gd0" / prov.code
    out_dir.mkdir(parents=True, exist_ok=True)
    conn = db.connect(cfg.path("db"))
    client = PoliteClient.from_config(cfg)
    result: dict = {"province": asdict(prov), "user_agent": cfg.user_agent}
    try:
        for source in sources:
            db.set_checkpoint(conn, "gd0", prov.code, source, "running")
            try:
                if source == "sgd":
                    r = probe_sgd(client, cfg, prov)
                elif source == "registry":
                    r = probe_registry(client, cfg)
                elif source == "places":
                    r = probe_places(cfg, conn, prov, places_tier, places_queries)
                    site_urls = site_urls + r.pop("_websites", [])
                elif source == "websites":
                    r = probe_websites(client, cfg, site_urls, site_limit)
                else:
                    raise ValueError(f"Nguồn không hỗ trợ: {source}")
                _store(conn, source, prov, r)
                result[source] = r
                db.set_checkpoint(conn, "gd0", prov.code, source, _outcome(source, r))
            except Exception as e:   # ghi log, đánh dấu checkpoint, chạy tiếp nguồn khác
                log.exception("probe %s/%s lỗi", prov.code, source)
                result[source] = {"error": f"{type(e).__name__}: {e}"}
                db.set_checkpoint(conn, "gd0", prov.code, source, "failed", str(e)[:500])
    finally:
        client.close()
        conn.close()
    path = out_dir / "probe.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    (out_dir / "summary.md").write_text(summarize(result), encoding="utf-8")
    return path


def _outcome(source: str, r: dict) -> str:
    """done | skipped | failed — để checkpoint phản ánh đúng việc nguồn có lấy được dữ liệu hay không."""
    if r.get("skipped") or r.get("note"):
        return "skipped"
    if source == "sgd":
        return "done" if r.get("total_records") else "failed"
    if source == "registry":
        return "done" if any(p["robots"] in ("ok", "missing") for p in r["portals"]) else "failed"
    if source == "websites":
        return "skipped" if not r["sites"] else ("done" if r["alive"] else "failed")
    return "done"


def summarize(r: dict) -> str:
    p = r["province"]
    lines = [f"# Khảo sát GĐ0 — {p['name']} ({p['code']})", ""]
    if "sgd" in r:
        s = r["sgd"]
        lines.append("## Sở GD&ĐT")
        for src in s.get("sources", []):
            lines.append(f"- {src['url']}: robots={src['robots_allowed']}, bản ghi={src['records']}, "
                         f"lỗi={len(src['errors'])}" + (f" ({src['errors'][0][:160]})" if src["errors"] else ""))
            for page in src.get("pages", []):
                lines.append(f"  - {page['format']} {page['url']} — {page['tables']} bảng {page.get('notes') or ''}")
            if src.get("fill_rate"):
                lines.append(f"  - tỷ lệ điền: {src['fill_rate']}")
        if s.get("note") or s.get("error"):
            lines.append(f"- {s.get('note') or s.get('error')}")
        lines.append("")
    if "registry" in r:
        lines.append("## Đăng ký doanh nghiệp")
        for portal in r["registry"].get("portals", []):
            lines.append(f"- {portal['name']}: robots={portal['robots']}, cho phép={portal['home_allowed']}, "
                         f"chặn={portal['blocked']}, captcha={portal['captcha_on_page']}, "
                         f"điều khoản={portal['terms_links'][:3]}")
        lines.append("")
    if "places" in r:
        lines.append("## Google Places")
        lines.append("```json\n" + json.dumps(r["places"], ensure_ascii=False, indent=2) + "\n```\n")
    if "websites" in r:
        w = r["websites"]
        lines.append("## Website trung tâm")
        if "sites" in w:
            lines.append(f"- {len(w['sites'])} site, còn sống {w['alive']}, park {w['parked']}")
            lines.append(f"- tỷ lệ điền: {w['fill_rate']}")
            for site in w["sites"]:
                if site["errors"]:
                    lines.append(f"  - {site['url']}: {site['errors'][0][:160]}")
        else:
            lines.append(f"- {w}")
    return "\n".join(lines) + "\n"
