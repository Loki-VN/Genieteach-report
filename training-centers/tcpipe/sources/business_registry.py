"""Nguồn 2: thông tin đăng ký doanh nghiệp công khai.

GĐ0 chỉ khảo sát: robots.txt, trang chủ có chặn bot/CAPTCHA không, form tra cứu có mã xác nhận
không. Việc trích xuất chỉ được bật (business_registry.portals[].enabled) sau khi đã đọc điều
khoản từng cổng và xác nhận được phép. Không vượt CAPTCHA, không đăng nhập.
"""
from __future__ import annotations

import re
from urllib.parse import urljoin

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from ..http import BlockedError, FetchError, PoliteClient
from ..normalize import fold

_CAPTCHA_FORM = re.compile(r"captcha|recaptcha|hcaptcha|turnstile|ma xac nhan|ma bao mat|nhap ma", re.I)
_TERMS_LINK = re.compile(r"dieu khoan|chinh sach|terms|quy dinh su dung|privacy")

REGISTRY_STATUS = {
    # trạng thái ĐKDN/thuế thường gặp → nhóm trạng thái pipeline (xem status.py)
    "Đang hoạt động": "active",
    "NNT đang hoạt động (đã được cấp GCN ĐKT)": "active",
    "Tạm ngừng kinh doanh có thời hạn": "suspended",
    "NNT ngừng hoạt động nhưng chưa hoàn thành thủ tục đóng MST": "closed",
    "Ngừng hoạt động và đã đóng MST": "closed",
    "Đã giải thể": "closed",
    "NNT không hoạt động tại địa chỉ đã đăng ký": "suspended",
}


def probe_portal(client: PoliteClient, base_url: str) -> dict:
    out: dict = {"base_url": base_url, "robots": None, "home_allowed": None, "blocked": None,
                 "captcha_on_page": None, "terms_links": [], "search_forms": 0, "errors": []}
    try:
        _, status = client.robots_status(base_url)
        out["robots"] = status
        out["home_allowed"] = client.allowed(base_url)
        if not out["home_allowed"]:
            return out
        r = client.get(base_url, use_cache=False)
    except BlockedError as e:
        out["blocked"] = str(e)
        return out
    except FetchError as e:
        out["errors"].append(f"{type(e).__name__}: {e}")
        return out
    out["blocked"] = False
    out["http_status"] = r.status
    tree = HTMLParser(r.text)
    out["captcha_on_page"] = bool(_CAPTCHA_FORM.search(fold(r.text[:300_000])))
    out["search_forms"] = len(tree.css("form"))
    for a in tree.css("a[href]"):
        if _TERMS_LINK.search(fold(a.text())):
            out["terms_links"].append(urljoin(r.final_url, a.attributes.get("href") or ""))
    out["terms_links"] = sorted(set(out["terms_links"]))[:10]
    return out
