"""Suy ra operating_status từ nhiều tín hiệu, luôn kèm status_evidence.

Quy tắc (theo thứ tự):
  1. Tín hiệu tiêu cực có thẩm quyền (ĐKDN: giải thể/đóng MST/tạm ngừng; Sở: đình chỉ/thu hồi)
     → closed / suspended.
  2. Places CLOSED_PERMANENTLY / CLOSED_TEMPORARILY mà không có tín hiệu tích cực gần đây
     → closed / suspended.
  3. ≥ 2 tín hiệu tích cực độc lập, trong đó ≥ 1 tín hiệu gần đây (≤ recent_activity_months) → active.
  4. ≥ 1 tín hiệu tích cực → likely_active.
  5. Còn lại → unknown.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .normalize import fold

REGISTRY_CLOSED = ("giai the", "dong ma so thue", "dong mst", "cham dut hoat dong", "thu hoi giay chung nhan",
                   "ngung hoat dong va da dong", "ngung hoat dong nhung chua")
REGISTRY_SUSPENDED = ("tam ngung", "khong hoat dong tai dia chi")
REGISTRY_ACTIVE = ("dang hoat dong", "nnt dang hoat dong")


@dataclass
class StatusSignals:
    registry_status: str | None = None           # nguyên văn từ ĐKDN
    places_business_status: str | None = None     # OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY
    license_state: str | None = None              # listed | suspended | revoked (theo danh sách Sở)
    license_list_date: date | None = None         # ngày cập nhật danh sách Sở có trung tâm
    website_alive: bool | None = None             # HTTP 200, không phải domain bị park
    last_activity_date: date | None = None        # bài đăng/tin tuyển sinh/đánh giá gần nhất


def _months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def decide_status(s: StatusSignals, recent_months: int = 12, today: date | None = None) -> tuple[str, str]:
    today = today or date.today()
    ev: list[str] = []
    reg = fold(s.registry_status)

    if reg and any(k in reg for k in REGISTRY_CLOSED):
        return "closed", f"ĐKDN: {s.registry_status}"
    if s.license_state == "revoked":
        return "closed", "Sở GD&ĐT: thu hồi/giải thể"
    if reg and any(k in reg for k in REGISTRY_SUSPENDED):
        return "suspended", f"ĐKDN: {s.registry_status}"
    if s.license_state == "suspended":
        return "suspended", "Sở GD&ĐT: đình chỉ hoạt động"

    positives: list[tuple[str, bool]] = []          # (mô tả, có phải tín hiệu gần đây)
    if reg and any(k in reg for k in REGISTRY_ACTIVE):
        positives.append((f"ĐKDN: {s.registry_status}", False))
    if s.places_business_status == "OPERATIONAL":
        positives.append(("Google Places: OPERATIONAL", True))
    if s.license_state == "listed" and s.license_list_date:
        recent = _months_between(s.license_list_date, today) <= recent_months
        positives.append((f"Có trong danh sách Sở ({s.license_list_date.isoformat()})", recent))
    if s.website_alive:
        positives.append(("Website còn hoạt động (HTTP 200, không park)", False))
    if s.last_activity_date:
        recent = _months_between(s.last_activity_date, today) <= recent_months
        if recent:
            positives.append((f"Hoạt động gần nhất {s.last_activity_date.isoformat()}", True))
        else:
            ev.append(f"hoạt động gần nhất đã cũ ({s.last_activity_date.isoformat()})")
    if s.website_alive is False:
        ev.append("website không truy cập được hoặc bị park")

    if s.places_business_status in ("CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"):
        recent_pos = [p for p, recent in positives if recent and not p.startswith("Google")]
        label = "closed" if s.places_business_status == "CLOSED_PERMANENTLY" else "suspended"
        if not recent_pos:
            return label, "; ".join([f"Google Places: {s.places_business_status}"] + [p for p, _ in positives] + ev)
        ev.append(f"Google Places báo {s.places_business_status} nhưng có tín hiệu gần đây khác")

    descs = [p for p, _ in positives]
    if len(positives) >= 2 and any(recent for _, recent in positives):
        return "active", "; ".join(descs + ev)
    if positives:
        return "likely_active", "; ".join(descs + ev)
    return "unknown", "; ".join(ev) or "Chưa có tín hiệu"
