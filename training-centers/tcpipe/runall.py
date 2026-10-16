"""Chạy toàn bộ: nguồn Sở theo từng tỉnh → website trung tâm → build → xuất Excel.

Chạy lại được: tỉnh nào đã `done` ở bảng checkpoints thì bỏ qua (trừ khi --refresh).
"""
from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

from . import db
from .admin_units import province_by_code
from .crawl import crawl_sites, sgd_site_candidates
from .probe import run_probe

log = logging.getLogger(__name__)

from .build import SEEDS_FILE as SITES_FILE


def run_all(cfg, *, provinces: list[str] | None = None, refresh: bool = False, workers: int = 4,
            site_workers: int = 6, out: Path | None = None, notes: list[str] | None = None) -> dict:
    from .build import build
    from .export import export_excel

    codes = provinces or sorted(cfg["sgd_sources"])
    conn = db.connect(cfg.path("db"))
    todo = [c for c in codes if refresh or db.checkpoint_status(conn, "gd0", c, "sgd") != "done"]
    conn.close()
    report: dict = {"sgd": {}, "skipped_done": sorted(set(codes) - set(todo))}

    def one(code: str) -> tuple[str, str]:
        run_probe(cfg, province_by_code(code), ["sgd"], site_urls=[], site_limit=0,
                  places_tier="ids_only", places_queries=0)
        c = db.connect(cfg.path("db"))
        try:
            return code, db.checkpoint_status(c, "gd0", code, "sgd") or "?"
        finally:
            c.close()

    with ThreadPoolExecutor(workers) as ex:          # mỗi tỉnh một host Sở khác nhau → chạy song song an toàn
        for fut in as_completed([ex.submit(one, c) for c in todo]):
            code, status = fut.result()
            report["sgd"][code] = status
            log.info("Sở %s: %s", code, status)

    entries = json.loads(SITES_FILE.read_text(encoding="utf-8")) if SITES_FILE.exists() else []
    conn = db.connect(cfg.path("db"))
    entries += sgd_site_candidates(conn)
    conn.close()
    report["websites"] = crawl_sites(cfg, entries, site_workers, skip_done=not refresh)

    conn = db.connect(cfg.path("db"))
    try:
        report["build"] = build(conn, cfg)
        out = out or cfg.path("db").parent / "exports" / f"trung-tam-{date.today()}.xlsx"
        report["export"] = export_excel(conn, out, notes or [])
        report["file"] = str(out)
    finally:
        conn.close()
    return report
