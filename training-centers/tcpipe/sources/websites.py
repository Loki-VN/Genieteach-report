"""Nguồn 4 + 5: website chính thức của trung tâm (và URL fanpage tìm thấy trên website).

Chỉ đọc các trang: trang chủ, Giới thiệu, Liên hệ, Hệ thống cơ sở, Tuyển dụng (+ footer có sẵn
trong mỗi trang). Không crawl Facebook/Zalo — chỉ ghi nhận URL fanpage xuất hiện trên website.
Liên hệ cá nhân chỉ ghi khi tên + chức danh + SĐT/email cùng xuất hiện công khai trên trang.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date
from urllib.parse import urljoin, urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from ..classify import classify_subjects, delivery_mode
from ..http import FetchError, PoliteClient
from ..normalize import (SURNAMES, clean_text, extract_emails, extract_phones, extract_tax_codes, fold, host_of,
                         is_role_email, normalize_facebook_url, normalize_phone)
from ..scale import Claim, extract_claims, extract_founded_year

log = logging.getLogger(__name__)

PAGE_KEYWORDS = [
    ("about", r"gioi-thieu|gioithieu|ve-chung-toi|about|ve-[a-z-]+|cau-chuyen|lich-su"),
    ("contact", r"lien-he|lienhe|contact"),
    ("branches", r"he-thong|co-so|chi-nhanh|dia-chi|campus|locations?|trung-tam-[a-z-]+"),
    ("careers", r"tuyen-dung|tuyendung|careers?|recruit|viec-lam"),
]
_PAGE_TEXT = re.compile(r"gioi thieu|ve chung toi|lien he|he thong|co so|chi nhanh|tuyen dung|about|contact")
_PARKED = re.compile(r"domain (?:is )?for sale|this domain (?:may be|is) for sale|buy this domain|parkingcrew|sedoparking|"
                     r"hugedomains|dan\.com|ten mien nay dang duoc rao ban|ten mien dang cho|domain da het han|"
                     r"website (?:da|dang) (?:het han|tam ngung)|account suspended|default web site page")
_STREET_HINT = re.compile(r"(?<![a-z])(so \d|\d+[a-z]?(?:/\d+)*\s|duong|pho|ngo|ngach|hem|kiet|tang|toa|kdt|lo [a-z]?\d|thon|ap|to \d)")
_AREA_HINT = re.compile(r"(?<![a-z])(phuong|quan|huyen|xa|thi xa|thi tran|tp\.?|thanh pho|tinh|p\.|q\.|tx\.?)(?![a-z])")
_BRANCH_LABEL = re.compile(r"^(?:co so|cs|chi nhanh|campus|dia chi|tru so(?: chinh)?(?: tai)?|van phong|address)"
                           r"\s*\d*\s*[:.\-–]?\s*")
_LOWER = "a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ"
_UPPER = "A-ZĐÂĂÊÔƠƯÁÀẢÃẠÉÈẺẼẸÍÌỈĨỊÓÒỎÕỌÚÙỦŨỤÝỲỶỸỴ"
_PERSON = re.compile(
    r"(?P<title>Tổng giám đốc|Phó giám đốc|Giám đốc|Founder|Co-?founder|CEO|Nhà sáng lập|Đồng sáng lập|Hiệu trưởng|"
    r"Người đại diện(?: theo pháp luật)?|Chủ tịch)[ \t]*(?:điều hành[ \t]*)?[:\-–]?[ \t]*"
    r"(?P<honor>Ông|Bà|ThS\.?|TS\.?|PGS\.?[ \t]*TS\.?|Mr\.?|Ms\.?|Mrs\.?)?[ \t]*"
    rf"(?P<name>[{_UPPER}][{_LOWER}]+(?:[ \t]+[{_UPPER}][{_LOWER}]+){{1,4}})"
)
# Họ phổ biến: tên không có kính ngữ thì phải bắt đầu bằng một họ để tránh bắt nhầm
# "Đồng sáng lập Apollo English", "Hiệu trưởng Trường Phổ thông"…
_SURNAMES = SURNAMES
_NOT_NAME = re.compile(r"^(truong|trung|cong|nhom|he|hoc|anh|tieng|tap|to|vien|so|phong|ban)\b")
_DATE_DMY = re.compile(r"(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-]((?:20)\d{2})(?!\d)")
_DATE_ISO = re.compile(r"(?<!\d)(20\d{2})-(\d{2})-(\d{2})")
# <meta property="article:modified_time" content="…">, JSON-LD "dateModified": "…", <time datetime="…">
_META_DATE = re.compile(r"(?:article:(?:published|modified)_time|datePublished|dateModified|datetime)[\"']?\s*"
                        r"(?:content\s*=|:|=)\s*[\"'](\d{4}-\d{2}-\d{2})")


@dataclass
class SiteResult:
    url: str
    final_url: str | None = None
    alive: bool | None = None
    parked: bool = False
    pages: list[str] = field(default_factory=list)
    title: str | None = None
    site_name: str | None = None                                         # og:site_name
    phones: list[tuple[str, str]] = field(default_factory=list)          # (số, url)
    emails: list[tuple[str, str]] = field(default_factory=list)          # (email, url) — email chung
    fanpage_urls: list[str] = field(default_factory=list)
    branch_addresses: list[tuple[str, str]] = field(default_factory=list)  # (địa chỉ gốc, url)
    persons: list[dict] = field(default_factory=list)                    # {name,title,phone,email,source_url}
    claims: list[Claim] = field(default_factory=list)
    tax_codes: list[str] = field(default_factory=list)
    founded_year: int | None = None
    last_activity_date: str | None = None
    category: str | None = None
    subjects: list[str] = field(default_factory=list)
    delivery_mode: str = "unknown"
    delivery_mode_evidence: str = ""
    errors: list[str] = field(default_factory=list)


def page_text(html: str) -> tuple[HTMLParser, str]:
    tree = HTMLParser(html)
    for node in tree.css("script, style, noscript, svg"):
        node.decompose()
    body = tree.body or tree.root
    text = body.text(separator="\n") if body else ""
    lines = [clean_text(l) for l in text.split("\n")]
    return tree, "\n".join(l for l in lines if l)


def pick_pages(tree: HTMLParser, base_url: str, limit: int) -> list[str]:
    host = host_of(base_url)
    scored: dict[str, int] = {}
    for a in tree.css("a[href]"):
        url = urljoin(base_url, (a.attributes.get("href") or "").split("#")[0])
        if host_of(url) != host or not url.startswith("http") or re.search(r"\.(jpg|png|pdf|zip|docx?)$", url, re.I):
            continue
        path = fold(urlsplit(url).path)
        text = fold(a.text())
        score = sum(3 for _, pat in PAGE_KEYWORDS if re.search(pat, path))
        score += 2 if _PAGE_TEXT.search(text) else 0
        if score and url.rstrip("/") != base_url.rstrip("/"):
            scored[url] = max(scored.get(url, 0), score - path.count("/"))
    return [u for u, _ in sorted(scored.items(), key=lambda kv: -kv[1])][:limit]


def _branch_addresses(text: str) -> list[str]:
    """Dòng dạng 'Cơ sở 2: 45 Nguyễn Trãi, Q. Thanh Xuân, Hà Nội' → địa chỉ (bỏ nhãn)."""
    out: dict[str, str] = {}
    for line in text.split("\n"):
        if not 10 <= len(line) <= 200:
            continue
        f = fold(line)                      # cùng độ dài với line (đã clean_text)
        m = _BRANCH_LABEL.match(f)
        if not m:
            continue
        addr = line[m.end():].strip(" :-–")
        fa = fold(addr)
        if _STREET_HINT.search(fa) and _AREA_HINT.search(fa):
            out.setdefault(fa, addr)
    return list(out.values())


def _persons(text: str, url: str) -> list[dict]:
    people = []
    for m in _PERSON.finditer(text):
        name = m.group("name").strip()
        f = fold(name)
        if not m.group("honor") and (f.split()[0] not in _SURNAMES or _NOT_NAME.match(f)):
            continue
        window = text[max(0, m.start() - 40): m.end() + 120]
        phones = [p for p in extract_phones(window) if p not in extract_tax_codes(window)]
        emails = [e for e in extract_emails(window) if not is_role_email(e)]
        people.append({"name": name, "title": m.group("title"),
                       "phone": phones[0] if phones else None, "email": emails[0] if emails else None,
                       "source_url": url})
    return people


def _dates(html: str, text: str) -> list[date]:
    out = []
    for m in _META_DATE.finditer(html):
        y, mo, d = map(int, m.group(1).split("-"))
        out.append(date(y, mo, d))
    for m in _DATE_DMY.finditer(text):
        d, mo, y = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            out.append(date(y, mo, d))
    for m in _DATE_ISO.finditer(text):
        y, mo, d = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            out.append(date(y, mo, d))
    today = date.today()
    return [d for d in out if d <= today]


def crawl_site(client: PoliteClient, url: str, categories: dict, max_pages: int = 8) -> SiteResult:
    res = SiteResult(url=url)
    try:
        home = client.get(url)
    except FetchError as e:
        res.alive = False
        res.errors.append(f"{type(e).__name__}: {e}")
        return res
    res.final_url = home.final_url
    res.alive = home.status == 200
    if not res.alive or "html" not in (home.content_type or "html"):
        res.errors.append(f"HTTP {home.status}")
        return res
    tree, text = page_text(home.text)
    title = tree.css_first("title")
    res.title = clean_text(title.text()) if title else None
    site_name = tree.css_first('meta[property="og:site_name"]') or tree.css_first('meta[name="application-name"]')
    res.site_name = clean_text(site_name.attributes.get("content")) if site_name else None
    if _PARKED.search(fold(text[:3000] + " " + (res.title or ""))) or len(text) < 200 and "domain" in fold(text):
        res.parked, res.alive = True, False
        return res
    pages = [(home.final_url, home.text, tree, text)]
    for link in pick_pages(tree, home.final_url, max_pages - 1):
        try:
            r = client.get(link)
        except FetchError as e:
            res.errors.append(f"{link}: {type(e).__name__}: {e}")
            continue
        if r.status == 200 and "html" in (r.content_type or ""):
            t, txt = page_text(r.text)
            pages.append((r.final_url, r.text, t, txt))

    all_text, dates = [], []
    seen_phone, seen_email, seen_fb = set(), set(), set()
    for page_url, html, t, txt in pages:
        res.pages.append(page_url)
        all_text.append(txt)
        for a in t.css("a[href]"):
            href = (a.attributes.get("href") or "").strip()
            if href.lower().startswith("tel:"):
                p = normalize_phone(href[4:])
                if p and p not in seen_phone:
                    seen_phone.add(p)
                    res.phones.append((p, page_url))
            elif href.lower().startswith("mailto:"):
                e = href[7:].split("?")[0].strip().lower()
                if e and e not in seen_email:
                    seen_email.add(e)
                    res.emails.append((e, page_url))
            else:
                fb = normalize_facebook_url(urljoin(page_url, href))
                if fb and fb not in seen_fb:
                    seen_fb.add(fb)
                    res.fanpage_urls.append(fb)
        taxes = extract_tax_codes(txt)
        res.tax_codes.extend(t for t in taxes if t not in res.tax_codes)
        for p in extract_phones(txt):
            if p in taxes or p.split("-")[0] in {t.split("-")[0] for t in taxes}:
                continue
            if p not in seen_phone:
                seen_phone.add(p)
                res.phones.append((p, page_url))
        for e in extract_emails(txt):
            if e not in seen_email:
                seen_email.add(e)
                res.emails.append((e, page_url))
        for addr in _branch_addresses(txt):
            if fold(addr) not in {fold(a) for a, _ in res.branch_addresses}:
                res.branch_addresses.append((addr, page_url))
        res.persons.extend(_persons(txt, page_url))
        res.claims.extend(extract_claims(txt, page_url))
        dates.extend(_dates(html, txt))

    # Email/SĐT gắn với một người cụ thể → liên hệ cá nhân, không phải liên hệ chung.
    personal_emails = {p["email"] for p in res.persons if p["email"]}
    personal_phones = {p["phone"] for p in res.persons if p["phone"]}
    res.emails = [(e, u) for e, u in res.emails if e not in personal_emails]
    res.phones = [(p, u) for p, u in res.phones if p not in personal_phones]

    joined = "\n".join(all_text)
    res.founded_year = extract_founded_year(joined)
    res.last_activity_date = max(dates).isoformat() if dates else None
    res.category, res.subjects = classify_subjects(f"{res.title or ''}\n{joined[:20000]}", categories,
                                                   title=res.title or "")
    res.delivery_mode, res.delivery_mode_evidence = delivery_mode(joined)
    return res
