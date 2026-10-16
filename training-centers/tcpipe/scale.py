"""Ước lượng quy mô (số học viên đang theo học) và quy đổi ra scale_bucket.

Thứ tự ưu tiên tín hiệu:
  1. Con số trung tâm tự công bố ("hơn 5.000 học viên") — kèm câu trích + URL.
  2. Số cơ sở, số giáo viên.
  3. Số lượt đánh giá Google (tổng các cơ sở).
  4. Quy mô ghi trong quyết định cấp phép.
Tham số nằm ở config.yaml → scale; công thức chi tiết trong README.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import date

from .normalize import clean_text, fold

_NUM = r"(?P<num>\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(?P<mult>k|nghin|ngan|trieu|tr|m)?\s*\+?"
_LEARNERS = re.compile(
    rf"(?P<qual>hon|tren|gan|khoang|toi|over|more than)?\s*{_NUM}\s*(?:luot\s+)?"
    r"(?P<unit>hoc vien|hoc sinh|hoc tro|students?|learners?)(?![a-z])"
)
_BRANCHES = re.compile(rf"(?:hon|tren|gan|over)?\s*{_NUM}\s*(?:co so|chi nhanh|campus|diem hoc|trung tam)(?!\s*vat chat)(?![a-z])")
_BRANCH_LABEL = re.compile(r"(?<![a-z])(?:co so|cs|chi nhanh|campus)\s*(?P<n>\d{1,3})(?![\d])")
_TEACHERS = re.compile(rf"(?:hon|tren|gan|over)?\s*{_NUM}\s*(?:giao vien|giang vien|teachers?|tutors?)(?![a-z])")
_FOUNDED = re.compile(r"(?:thanh lap|ra doi|khai truong|founded|since|hoat dong tu)\s*(?:tu |vao |nam |tu nam |vao nam )*(?P<y>(?:19|20)\d{2})")

_CUMULATIVE = re.compile(
    r"da dao tao|dao tao (?:hon|tren|cho)|da dong hanh|tinh den nay|tu khi thanh lap|cuu hoc vien|alumni|"
    r"luot hoc vien|da tin (?:tuong|chon)|da theo hoc|da va dang|trained|over the years"
)
_ANNUAL = re.compile(r"moi nam|hang nam|/\s*nam|mot nam|per year|a year|each year|nam hoc")
_CURRENT = re.compile(r"dang theo hoc|hien co|hien dang|dang hoc|currently|dang dong hanh")


@dataclass
class Claim:
    kind: str            # learners_current | learners_annual | learners_cumulative | branches | teachers
    value: int
    quote: str
    url: str | None = None


@dataclass
class ScaleResult:
    estimate: int | None
    bucket: str
    confidence: str | None
    evidence: str
    method: str
    notes: list[str] = field(default_factory=list)


def _parse_number(num: str, mult: str | None) -> int | None:
    s = num.strip()
    if re.fullmatch(r"\d{1,3}(?:[.,\s]\d{3})+", s):
        value = float(re.sub(r"[.,\s]", "", s))
    else:
        value = float(s.replace(",", "."))
    factor = {"k": 1e3, "nghin": 1e3, "ngan": 1e3, "trieu": 1e6, "tr": 1e6, "m": 1e6}.get(mult or "", 1)
    out = int(round(value * factor))
    return out if out > 0 else None


def _quote(original: str, start: int, end: int, pad: int = 60) -> str:
    a, b = max(0, start - pad), min(len(original), end + pad)
    return ("…" if a else "") + original[a:b].strip() + ("…" if b < len(original) else "")


def extract_claims(text: str, url: str | None = None) -> list[Claim]:
    original = clean_text(text)
    folded = fold(original)       # cùng độ dài với original (văn bản NFC)
    claims: list[Claim] = []
    for m in _LEARNERS.finditer(folded):
        value = _parse_number(m.group("num"), m.group("mult"))
        if not value or value < 20:
            continue
        ctx = folded[max(0, m.start() - 70): m.end() + 50]
        if _CURRENT.search(ctx):
            kind = "learners_current"
        elif _ANNUAL.search(ctx):
            kind = "learners_annual"
        else:
            kind = "learners_cumulative"   # không rõ ngữ cảnh → coi là tích lũy (thận trọng)
        claims.append(Claim(kind, value, _quote(original, m.start(), m.end()), url))
    for pattern, kind in ((_BRANCHES, "branches"), (_TEACHERS, "teachers")):
        for m in pattern.finditer(folded):
            value = _parse_number(m.group("num"), m.group("mult"))
            if value and value < 5000:
                claims.append(Claim(kind, value, _quote(original, m.start(), m.end()), url))
    labels = {int(m.group("n")) for m in _BRANCH_LABEL.finditer(folded)}
    if len(labels) >= 2:
        claims.append(Claim("branches", max(labels), f"liệt kê cơ sở đánh số tới {max(labels)}", url))
    return claims


def extract_founded_year(text: str) -> int | None:
    years = [int(m.group("y")) for m in _FOUNDED.finditer(fold(text))]
    years = [y for y in years if 1975 <= y <= date.today().year]
    return min(years) if years else None


def bucket_of(estimate: int | None, buckets: list) -> str:
    if estimate is None:
        return "unknown"
    name = buckets[0][0]
    for label, lower in buckets:
        if estimate >= lower:
            name = label
    return name


def _bucket_index(bucket: str, buckets: list) -> int:
    return [b[0] for b in buckets].index(bucket)


_DOWN = {"high": "medium", "medium": "low", "low": "low"}


def estimate_scale(claims: list[Claim], params: dict, *, category: str = "khac",
                   num_branches: int | None = None, google_reviews_total: int | None = None,
                   license_capacity: int | None = None, founded_year: int | None = None,
                   today: date | None = None) -> ScaleResult:
    buckets = params["buckets"]
    today = today or date.today()
    candidates: list[tuple[int, str, str, str]] = []   # (ước lượng, độ tin cậy, mô tả, method)

    def best(kind: str) -> Claim | None:
        cs = [c for c in claims if c.kind == kind]
        return max(cs, key=lambda c: c.value) if cs else None

    def cite(c: Claim) -> str:
        return f"«{c.quote}»" + (f" ({c.url})" if c.url else "")

    # 1. tự công bố
    if c := best("learners_current"):
        candidates.append((c.value, "high", f"Tự công bố đang học: {cite(c)}", "self_current"))
    elif c := best("learners_annual"):
        est = round(c.value * params["annual_to_active"])
        candidates.append((est, "high", f"Tự công bố/năm: {cite(c)} × {params['annual_to_active']}", "self_annual"))
    elif c := best("learners_cumulative"):
        if founded_year:
            years = max(1, today.year - founded_year)
            conf = "medium"
        else:
            years, conf = params["cumulative_default_years"], "low"
        est = round(c.value / years * params["cumulative_growth_factor"])
        candidates.append((est, conf, f"Tự công bố tích lũy: {cite(c)} ÷ {years} năm × "
                           f"{params['cumulative_growth_factor']}", "self_cumulative"))

    # 2. số cơ sở / giáo viên
    branch_claim = best("branches")
    branches = max([v for v in (num_branches, branch_claim.value if branch_claim else None) if v] or [0])
    teacher_claim = best("teachers")
    per_branch = params["learners_per_branch"].get(category, params["learners_per_branch"]["khac"])
    est_b = branches * per_branch if branches >= 2 else None
    est_t = teacher_claim.value * params["learners_per_teacher"] if teacher_claim else None
    if est_b and est_t:
        candidates.append((round(math.sqrt(est_b * est_t)), "medium",
                           f"{branches} cơ sở × {per_branch} và {teacher_claim.value} giáo viên × "
                           f"{params['learners_per_teacher']} (trung bình nhân)", "branches_teachers"))
    elif est_b:
        candidates.append((est_b, "medium" if branches >= 5 else "low",
                           f"{branches} cơ sở × {per_branch}", "branches"))
    elif est_t:
        candidates.append((est_t, "low", f"{teacher_claim.value} giáo viên × {params['learners_per_teacher']}: "
                           f"{cite(teacher_claim)}", "teachers"))

    # 3. đánh giá Google
    if google_reviews_total:
        candidates.append((google_reviews_total * params["learners_per_review"], "low",
                           f"{google_reviews_total} đánh giá Google × {params['learners_per_review']}", "reviews"))
    # 4. quyết định cấp phép
    if license_capacity:
        candidates.append((license_capacity, "low", f"Quy mô trong quyết định cấp phép: {license_capacity}", "license"))

    if not candidates:
        return ScaleResult(None, "unknown", None, "Chưa có tín hiệu quy mô", "none")

    est, conf, desc, method = candidates[0]
    bucket = bucket_of(est, buckets)
    notes = []
    for other_est, _, other_desc, other_method in candidates[1:]:
        gap = abs(_bucket_index(bucket_of(other_est, buckets), buckets) - _bucket_index(bucket, buckets))
        if gap >= params["disagreement_steps"]:
            notes.append(f"lệch {gap} bậc so với {other_method} ({other_desc} → {other_est})")
    if notes:
        conf = _DOWN[conf]
    evidence = f"{desc} → {est:,}".replace(",", ".") + f" → {bucket}"
    if notes:
        evidence += " | Cảnh báo: " + "; ".join(notes)
    return ScaleResult(est, bucket, conf, evidence, method, notes)
