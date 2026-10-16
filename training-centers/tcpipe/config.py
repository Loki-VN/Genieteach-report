"""Đọc config.yaml + .env, chuẩn hóa đường dẫn về thư mục dự án."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Config:
    raw: dict[str, Any]

    def __getitem__(self, key: str) -> Any:
        return self.raw[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.raw.get(key, default)

    def path(self, key: str) -> Path:
        p = Path(self.raw["paths"][key])
        return p if p.is_absolute() else ROOT / p

    @property
    def user_agent(self) -> str:
        contact = os.environ.get("CRAWLER_CONTACT_EMAIL") or "not-configured"
        return self.raw["crawl"]["user_agent"].format(contact=contact)

    @property
    def places_api_key(self) -> str | None:
        return os.environ.get("GOOGLE_PLACES_API_KEY") or None


def load_config(path: str | Path | None = None) -> Config:
    load_dotenv(ROOT / ".env")
    cfg_path = Path(path) if path else ROOT / "config.yaml"
    return Config(yaml.safe_load(cfg_path.read_text(encoding="utf-8")))
