"""Chuẩn hóa văn bản, số điện thoại, domain, email — dùng chung cho mọi nguồn và khử trùng lặp."""
from __future__ import annotations

import re
import unicodedata
from urllib.parse import urlsplit

_WS = re.compile(r"\s+")


def strip_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def fold(text: str | None) -> str:
    """Chữ thường, bỏ dấu, gộp khoảng trắng — dạng so khớp từ khóa."""
    if not text:
        return ""
    return _WS.sub(" ", strip_accents(unicodedata.normalize("NFC", text)).lower()).strip()


def clean_text(text: str | None) -> str:
    if not text:
        return ""
    return _WS.sub(" ", unicodedata.normalize("NFC", text)).strip()


# Từ chung không mang tính thương hiệu, bỏ đi khi so khớp tên (fuzzy).
_GENERIC = (
    "cong ty co phan|cong ty tnhh|cong ty|tnhh|co phan|mtv|mot thanh vien|"
    "trung tam|ngoai ngu|tin hoc|anh ngu|tieng anh|giao duc|dao tao|he thong|"
    "co so|chi nhanh|cs\\d+|education|edu|academy|english|center|centre|school|"
    "va|and|tai|ha noi|tp hcm|ho chi minh"
)
_GENERIC_RE = re.compile(rf"\b(?:{_GENERIC})\b")


def name_key(name: str | None) -> str:
    """Khóa tên cho rapidfuzz: bỏ dấu, bỏ từ chung, bỏ ký tự đặc biệt."""
    s = re.sub(r"[^a-z0-9 ]", " ", fold(name))
    s = _GENERIC_RE.sub(" ", s)
    return _WS.sub(" ", s).strip()


# ---------------------------------------------------------------------------
# Số điện thoại
# ---------------------------------------------------------------------------
_PHONE_CANDIDATE = re.compile(
    r"(?<![\d])(?:\(?\+?84\)?[\s.\-]*|0)(?:\d[\s.\-]*){8,10}(?![\d])"
    r"|(?<![\d])1[89]00(?:[\s.\-]*\d){4,6}(?![\d])"
)
_MOBILE_PREFIX = ("03", "05", "07", "08", "09")


def normalize_phone(raw: str | None) -> str | None:
    """Trả về dạng quốc gia (0xxxxxxxxx / 02xxxxxxxxx / 1900xxxx) hoặc None nếu không hợp lệ."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("84") and len(digits) in (11, 12):
        digits = "0" + digits[2:]
    elif len(digits) == 9 and digits[0] in "35789" or len(digits) == 10 and digits[0] == "2":
        digits = "0" + digits                      # số bị mất 0 đầu (Excel/PDF)
    if digits.startswith(("1900", "1800")) and len(digits) in (8, 10):
        return digits
    if len(digits) == 10 and digits.startswith(_MOBILE_PREFIX):
        return digits
    if len(digits) == 11 and digits.startswith("02"):
        return digits
    return None


def is_mobile(phone: str | None) -> bool:
    return bool(phone) and len(phone) == 10 and phone.startswith(_MOBILE_PREFIX)


def extract_phones(text: str) -> list[str]:
    seen: dict[str, None] = {}
    for m in _PHONE_CANDIDATE.finditer(text or ""):
        p = normalize_phone(m.group(0))
        if p:
            seen.setdefault(p)
    return list(seen)


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_EMAIL_JUNK = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", "sentry.io", "example.com", "wixpress.com")
_ROLE_LOCALPARTS = {
    "info", "contact", "lienhe", "hotro", "support", "admin", "cskh", "tuyensinh", "hr", "tuyendung",
    "marketing", "sales", "office", "hello", "hi", "enquiry", "enquiries", "customercare", "care",
}


def extract_emails(text: str) -> list[str]:
    out: dict[str, None] = {}
    for m in _EMAIL.finditer(text or ""):
        e = m.group(0).strip(".").lower()
        if not e.endswith(_EMAIL_JUNK):
            out.setdefault(e)
    return list(out)


def is_role_email(email: str) -> bool:
    """Email chung của tổ chức (info@, lienhe@…) — khác với email cá nhân."""
    local = email.split("@", 1)[0].lower()
    return local in _ROLE_LOCALPARTS or any(local.startswith(r) for r in ("info", "contact", "tuyensinh", "cskh"))


# ---------------------------------------------------------------------------
# Domain / URL
# ---------------------------------------------------------------------------
SOCIAL_HOSTS = {
    "facebook.com", "fb.com", "fb.me", "m.facebook.com", "zalo.me", "youtube.com", "youtu.be",
    "tiktok.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "messenger.com",
}
# Host dùng chung cho nhiều chủ thể: không dùng làm khóa khử trùng lặp theo domain.
SHARED_HOSTS = {
    "google.com", "goo.gl", "maps.app.goo.gl", "sites.google.com", "linktr.ee", "blogspot.com",
    "wixsite.com", "wordpress.com", "weebly.com", "business.site", "bio.link",
}


def host_of(url: str | None) -> str:
    if not url:
        return ""
    if "://" not in url:
        url = "http://" + url
    host = (urlsplit(url).hostname or "").lower().rstrip(".")
    for prefix in ("www.", "m.", "mobile."):
        if host.startswith(prefix):
            host = host[len(prefix):]
    return host


def _matches(host: str, hosts: set[str]) -> bool:
    return any(host == h or host.endswith("." + h) for h in hosts)


def is_social(url: str | None) -> bool:
    return _matches(host_of(url), SOCIAL_HOSTS)


def website_domain(url: str | None) -> str | None:
    """Domain dùng làm khóa khử trùng lặp; None nếu là mạng xã hội hoặc host dùng chung."""
    host = host_of(url)
    if not host or _matches(host, SOCIAL_HOSTS) or _matches(host, SHARED_HOSTS):
        return None
    return host


_FB_SKIP = re.compile(r"/(sharer|share|plugins|dialog|tr|login|groups|hashtag|story\.php|permalink\.php|watch|events|"
                      r"reel|photo\.php|photos|videos|posts|search|help|policies|privacy)(/|\.php|\?|$)", re.I)


def normalize_facebook_url(url: str | None) -> str | None:
    """Chuẩn hóa link fanpage tìm thấy trên website; bỏ link chia sẻ/plugin."""
    if not url or not _matches(host_of(url), {"facebook.com", "fb.com", "fb.me"}):
        return None
    parts = urlsplit(url if "://" in url else "https://" + url)
    if _FB_SKIP.search(parts.path or "") or parts.path in ("", "/"):
        return None
    path = parts.path.rstrip("/")
    if path.endswith("profile.php"):
        q = re.search(r"(?:^|&)(id=\d+)", parts.query or "")
        return f"https://www.facebook.com/profile.php?{q.group(1)}" if q else None
    if path.startswith("/pages/"):          # /pages/Ten-Trang/123456 → giữ nguyên
        return f"https://www.facebook.com{path}"
    handle = path.strip("/").split("/")[0]
    return f"https://www.facebook.com/{handle}" if handle else None


_TAX_CODE = re.compile(
    r"(?:mst|ma so thue|ma so doanh nghiep|ma doanh nghiep|gpkd|dkkd|giay chung nhan dang ky (?:doanh nghiep|kinh doanh))"
    r"\s*(?:so)?\s*[:.]?\s*(\d{10}(?:-\d{3})?)"
)


def extract_tax_codes(text: str) -> list[str]:
    """MST/mã số doanh nghiệp ghi trên website (10 số, hoặc 10 số + '-xxx' cho chi nhánh)."""
    return list(dict.fromkeys(m.group(1) for m in _TAX_CODE.finditer(fold(text))))
