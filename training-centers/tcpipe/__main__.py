"""CLI: python -m tcpipe <lệnh> …"""
from __future__ import annotations

import argparse
import json
import sys

from . import db
from .admin_units import normalize_address, provinces, resolve_province, wards_of
from .config import load_config
from .logsetup import setup_logging
from .sources.google_places import estimate_cost, estimate_sweep


EXPORT_NOTES = [
    "Sheet centers / branches / contacts_personal: theo schema trong README; mỗi dòng có source_urls / source_url.",
    "contacts_personal chứa dữ liệu cá nhân (tên, SĐT, email) lấy từ danh sách Sở GD&ĐT công bố công khai và từ "
    "website trung tâm. Chỉ dùng theo mục đích đã được pháp chế phê duyệt; không chia sẻ ra ngoài; xóa khi hết mục đích.",
    "Sheet nguon_so_gddt: dữ liệu thô từng dòng trong danh sách của Sở (kể cả dòng ngoài phạm vi như tư vấn du học, "
    "cột in_scope = FALSE). Sheet nguon_website: dữ liệu thô từ website. Sheet nhat_ky_nguon: mọi URL đã thử và kết quả.",
    "Phạm vi GĐ0: chỉ gồm các nguồn đọc được khi khảo sát (Điện Biên, Sơn La, Quảng Ninh + 10 website mẫu của "
    "các chuỗi ở Hà Nội). Danh sách Hà Nội chưa có vì file nằm trên host chặn crawler bằng robots.txt; "
    "Google Places chưa chạy vì chưa có API key.",
    "Quy mô (scale_*): unknown khi chưa có tín hiệu — không loại bản ghi. Công thức xem README.",
]


def _province(name: str):
    p = resolve_province(name)
    if not p:
        sys.exit(f"Không nhận ra tỉnh/thành: {name!r}")
    return p


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(prog="tcpipe", description="Pipeline trung tâm đào tạo ngoài nhà trường")
    ap.add_argument("--config", help="đường dẫn config.yaml")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init-db", help="tạo database SQLite theo schema")

    pr = sub.add_parser("probe", help="GĐ0: khảo sát nguồn cho một tỉnh")
    pr.add_argument("--province", required=True, help='ví dụ "Hà Nội", "Điện Biên", "01"')
    pr.add_argument("--sources", default="sgd,registry,places,websites")
    pr.add_argument("--site-url", action="append", default=[], help="website trung tâm để thử (lặp lại được)")
    pr.add_argument("--sites", type=int, default=10, help="số website tối đa")
    pr.add_argument("--places-tier", default="enterprise", choices=["ids_only", "pro", "enterprise"])
    pr.add_argument("--places-queries", type=int, default=3)

    ep = sub.add_parser("estimate-places", help="ước tính số request + chi phí Places (không gọi API)")
    ep.add_argument("--province", action="append", help="mặc định: toàn quốc")

    na = sub.add_parser("normalize-address", help="thử chuẩn hóa một địa chỉ")
    na.add_argument("address")

    sub.add_parser("purge-places-cache", help="xóa nội dung Places quá hạn lưu")

    cs = sub.add_parser("crawl-sites", help="crawl hàng loạt website trung tâm (song song theo domain)")
    cs.add_argument("--file", help="JSON [{url, province_hint?, brand_hint?, discovered_from?}] hoặc .txt mỗi dòng 1 URL")
    cs.add_argument("--from-sgd", action="store_true", help="thêm website suy từ email tổ chức trong danh sách Sở")
    cs.add_argument("--workers", type=int, default=6)
    cs.add_argument("--recrawl", action="store_true", help="crawl lại cả URL đã có trong nhật ký")

    ra = sub.add_parser("run-all", help="chạy hết: nguồn Sở các tỉnh → website → build → xuất Excel")
    ra.add_argument("--province", action="append", help="chỉ chạy các tỉnh này (mặc định: mọi tỉnh có nguồn trong config)")
    ra.add_argument("--refresh", action="store_true", help="chạy lại cả tỉnh/website đã xong")
    ra.add_argument("--workers", type=int, default=4, help="số tỉnh chạy song song")
    ra.add_argument("--out", help="đường dẫn .xlsx")

    iu = sub.add_parser("inspect-url", help="thử đọc một URL nguồn Sở (robots, định dạng, bảng, bản ghi) — không ghi DB")
    iu.add_argument("url")
    iu.add_argument("--province", default="00")

    sub.add_parser("build", help="gộp bản ghi nguồn thành centers/branches/contacts_personal")
    ex = sub.add_parser("export", help="build rồi xuất 1 file Excel (gồm cả liên hệ cá nhân)")
    ex.add_argument("--out", help="đường dẫn .xlsx (mặc định data/exports/trung-tam-<ngày>.xlsx)")

    args = ap.parse_args(argv)
    cfg = load_config(args.config)
    setup_logging(cfg.path("logs"))

    if args.cmd == "init-db":
        db.connect(cfg.path("db")).close()
        print(f"OK: {cfg.path('db')}")
    elif args.cmd == "probe":
        from .probe import run_probe

        path = run_probe(cfg, _province(args.province), args.sources.split(","), site_urls=args.site_url,
                         site_limit=args.sites, places_tier=args.places_tier, places_queries=args.places_queries)
        print(f"Kết quả: {path}\n{path.with_name('summary.md').read_text(encoding='utf-8')}")
    elif args.cmd == "estimate-places":
        g = cfg["google_places"]
        provs = [_province(n) for n in args.province] if args.province else provinces()
        est = estimate_sweep(cfg["categories"], g["sweep"], {p.code: wards_of(p.code) for p in provs})
        print(json.dumps(est, ensure_ascii=False, indent=2))
        for tier in ("pro", "enterprise"):
            one = estimate_cost({f"text_search_{tier}": est["requests"]}, g["pricing"])
            two = round(2 * estimate_cost({f"text_search_{tier}": est["requests"] // 2}, g["pricing"]), 2)
            print(f"Text Search {tier}: ~{one} USD nếu chạy trong 1 tháng; ~{two} USD nếu chia 2 tháng")
    elif args.cmd == "normalize-address":
        print(json.dumps(normalize_address(args.address).__dict__, ensure_ascii=False, indent=2))
    elif args.cmd in ("build", "export"):
        from datetime import date
        from pathlib import Path

        from .build import build
        from .export import export_excel

        conn = db.connect(cfg.path("db"))
        counts = build(conn, cfg)
        print(f"Đã dựng: {counts}")
        if args.cmd == "export":
            out = Path(args.out) if args.out else cfg.path("db").parent / "exports" / f"trung-tam-{date.today()}.xlsx"
            export_excel(conn, out, EXPORT_NOTES)
            print(f"Đã xuất: {out}")
    elif args.cmd == "run-all":
        from pathlib import Path

        from .runall import run_all

        codes = [_province(n).code for n in args.province] if args.province else None
        rep = run_all(cfg, provinces=codes, refresh=args.refresh, workers=args.workers,
                      out=Path(args.out) if args.out else None, notes=EXPORT_NOTES)
        print(json.dumps(rep, ensure_ascii=False, indent=1))
    elif args.cmd == "crawl-sites":
        from pathlib import Path

        from .crawl import crawl_sites, sgd_site_candidates

        entries = []
        if args.file:
            text = Path(args.file).read_text(encoding="utf-8")
            if args.file.endswith(".json"):
                entries += [e if isinstance(e, dict) else {"url": e} for e in json.loads(text)]
            else:
                entries += [{"url": line.strip(), "discovered_from": args.file}
                            for line in text.splitlines() if line.strip() and not line.startswith("#")]
        if args.from_sgd:
            conn = db.connect(cfg.path("db"))
            entries += sgd_site_candidates(conn)
            conn.close()
        print(json.dumps(crawl_sites(cfg, entries, args.workers, skip_done=not args.recrawl), ensure_ascii=False))
    elif args.cmd == "inspect-url":
        from .http import PoliteClient
        from .sources import sgd

        client = PoliteClient.from_config(cfg)
        try:
            res = sgd.probe_source(client, args.url, args.province, "Sở GD&ĐT")
        finally:
            client.close()
        res.pop("_records", None)
        res["attachments"] = [a for a in res.get("attachments", []) if a["score"] > 0][:12]
        res["list_links"] = res.get("list_links", [])[:12]
        res["samples"] = [{k: v for k, v in s.items() if v and k != "extra"} for s in res["samples"][:3]]
        for page in res["pages"]:
            page.pop("headers", None)
        print(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    elif args.cmd == "purge-places-cache":
        conn = db.connect(cfg.path("db"))
        print(f"Đã xóa {db.purge_expired_places(conn)} bản ghi Places quá hạn")


if __name__ == "__main__":
    main()
