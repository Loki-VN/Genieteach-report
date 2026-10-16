"""Phân loại category/subjects và hình thức học (online/offline/hybrid) từ văn bản."""
from __future__ import annotations

import re

from .normalize import fold

CATEGORY_LABELS = {"ngoai_ngu": "ngoại ngữ", "luyen_thi": "luyện thi", "tin_hoc_stem": "tin học-STEM",
                   "ky_nang": "kỹ năng", "khac": "khác"}

_ONLINE = re.compile(r"hoc (?:truc tuyen|online)|lop (?:truc tuyen|online)|e-?learning|qua zoom|google meet|"
                     r"1 kem 1 online|hoc tu xa|online 100%|100% online")
_OFFLINE = re.compile(r"(?:co so|chi nhanh|dia chi|campus|phong hoc|hoc tai trung tam|lop truc tiep|offline)")


def _hits(text: str, categories: dict) -> dict[str, list[str]]:
    """Khớp từ khóa. Từ khóa 're:…' là regex phân biệt hoa thường áp lên văn bản gốc (cho từ viết tắt
    như SAT, HSK), còn lại so khớp trên văn bản đã bỏ dấu, chữ thường."""
    f = f" {fold(text)} "
    hits: dict[str, list[str]] = {}
    for key, cat in categories.items():
        for subject, keywords in cat["subjects"].items():
            for k in keywords:
                ok = re.search(k[3:], text) if k.startswith("re:") else k in f
                if ok:
                    hits.setdefault(key, []).append(subject)
                    break
    return hits


def classify_subjects(text: str, categories: dict, title: str = "") -> tuple[str, list[str]]:
    """Trả về (category chính, danh sách subjects) theo từ khóa trong config.yaml.

    Category chính lấy theo tiêu đề/tên trung tâm nếu tiêu đề có từ khóa; nếu không thì theo
    loại hình có nhiều môn khớp nhất trong nội dung.
    """
    hits = _hits(f"{title}\n{text}", categories)
    if not hits:
        return "khac", []
    subjects = list(dict.fromkeys(s for k in hits for s in hits[k]))
    title_hits = _hits(title, categories) if title else {}
    if title_hits:
        order = list(categories)
        if "luyen_thi" in title_hits and re.search(r"luyen thi|on thi", fold(title)) or set(title_hits) == {"luyen_thi"}:
            return "luyen_thi", subjects
        return min(title_hits, key=lambda k: (-len(title_hits[k]), order.index(k))), subjects
    return max(hits, key=lambda k: len(hits[k])), subjects


def delivery_mode(text: str) -> tuple[str, str]:
    f = fold(text)
    on = _ONLINE.search(f)
    off = _OFFLINE.search(f)
    if on and off:
        return "hybrid", f"online: «{on.group(0)}»; offline: «{off.group(0)}»"
    if on:
        return "online", f"«{on.group(0)}»"
    if off:
        return "offline", f"«{off.group(0)}»"
    return "unknown", ""
