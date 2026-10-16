"""SQLite: khởi tạo schema, checkpoint, ghi bản ghi nguồn, đếm request API."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = Path(__file__).parent / "schema.sql"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA.read_text(encoding="utf-8"))
    return conn


def set_checkpoint(conn: sqlite3.Connection, stage: str, province: str, source: str,
                   status: str, detail: str | None = None) -> None:
    conn.execute(
        "INSERT INTO checkpoints(stage, province, source, status, detail, updated_at) VALUES (?,?,?,?,?,?) "
        "ON CONFLICT(stage, province, source) DO UPDATE SET status=excluded.status, "
        "detail=excluded.detail, updated_at=excluded.updated_at",
        (stage, province, source, status, detail, now_iso()),
    )
    conn.commit()


def checkpoint_status(conn: sqlite3.Connection, stage: str, province: str, source: str) -> str | None:
    row = conn.execute("SELECT status FROM checkpoints WHERE stage=? AND province=? AND source=?",
                       (stage, province, source)).fetchone()
    return row["status"] if row else None


def add_source_record(conn: sqlite3.Connection, source: str, province: str | None, source_url: str,
                      payload: dict) -> int:
    if not source_url:
        raise ValueError("source_url là bắt buộc")
    cur = conn.execute(
        "INSERT INTO source_records(source, province, source_url, payload, fetched_at) VALUES (?,?,?,?,?)",
        (source, province, source_url, json.dumps(payload, ensure_ascii=False), now_iso()),
    )
    return cur.lastrowid


def bump_usage(conn: sqlite3.Connection, sku: str, n: int = 1) -> None:
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    conn.execute(
        "INSERT INTO api_usage(month, sku, requests) VALUES (?,?,?) "
        "ON CONFLICT(month, sku) DO UPDATE SET requests = requests + excluded.requests",
        (month, sku, n),
    )
    conn.commit()


def usage_this_month(conn: sqlite3.Connection) -> dict[str, int]:
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    return {r["sku"]: r["requests"] for r in conn.execute("SELECT sku, requests FROM api_usage WHERE month=?", (month,))}


def purge_expired_places(conn: sqlite3.Connection) -> int:
    cur = conn.execute("DELETE FROM places_cache WHERE expires_at < ?", (now_iso(),))
    conn.commit()
    return cur.rowcount


def replace_source_records(conn: sqlite3.Connection, source: str, province: str | None) -> None:
    """Chạy lại một nguồn cho một tỉnh thì thay toàn bộ bản ghi cũ của lần trước."""
    conn.execute("DELETE FROM source_records WHERE source=? AND province IS ?", (source, province))
    conn.execute("DELETE FROM source_log WHERE source IN (?, ?) AND province IS ?", (source, f"{source}_file", province))


def log_source(conn: sqlite3.Connection, province: str | None, source: str, url: str, outcome: str,
               records: int | None = None, detail: str | None = None) -> None:
    conn.execute("INSERT INTO source_log(province, source, url, outcome, records, detail, checked_at) "
                 "VALUES (?,?,?,?,?,?,?)", (province, source, url, outcome, records, detail, now_iso()))
