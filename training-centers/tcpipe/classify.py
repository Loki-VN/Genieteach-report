"""Phân loại category/subjects và hình thức học (online/offline/hybrid) từ văn bản."""
from __future__ import annotations

import re

from .normalize import fold

CATEGORY_LABELS = {"ngoai_ngu": "ngoại ngữ", "luyen_thi": "luyện thi", "tin_hoc_stem": "tin học-STEM",
                   "ky_nang": "kỹ năng", "khac": "khác"}

_ONLINE = re.compile(r"hoc (?:truc tuyen|online)|lop (?:truc tuyen|online)|e-?learning|qua zoom|google meet|"
                     r"1 kem 1 online|hoc tu xa|online 100%|100% online")
_OFFLINE = re.compile(r"(?:co so|chi nhanh|dia chi|campus|phong hoc|hoc tai trung tam|lop truc tiep|offline)")


def classify_subjects(text: str, categories: dict) -> tuple[str, list[str]]:
    """Trả về (category chính, danh sách subjects) theo từ khóa trong config.yaml."""
    f = f" {fold(text)} "
    hits: dict[str, list[str]] = {}
    for key, cat in categories.items():
        for subject, keywords in cat["subjects"].items():
            if any(k in f for k in keywords):
                hits.setdefault(key, []).append(subject)
    if not hits:
        return "khac", []
    # luyện thi chứng chỉ ngoại ngữ (IELTS…) vẫn giữ category luyện thi nếu chỉ có môn thi
    main = max(hits, key=lambda k: len(hits[k]))
    subjects = [s for k in hits for s in hits[k]]
    return main, list(dict.fromkeys(subjects))


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
