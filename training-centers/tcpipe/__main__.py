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
    elif args.cmd == "purge-places-cache":
        conn = db.connect(cfg.path("db"))
        print(f"Đã xóa {db.purge_expired_places(conn)} bản ghi Places quá hạn")


if __name__ == "__main__":
    main()
