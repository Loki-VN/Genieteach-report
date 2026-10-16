"""Nguồn 1: danh sách / quyết định cho phép hoạt động do Sở GD&ĐT công bố.

Trang Sở thường là: bài viết + file đính kèm (.xlsx/.pdf/.doc), hoặc bảng HTML.
Module này: tìm file đính kèm và link danh sách → tải → đọc bảng → nhận diện cột → bản ghi.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import asdict, dataclass, field
from urllib.parse import urljoin, urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from ..http import FetchError, PoliteClient
from ..normalize import clean_text, fold, normalize_phone

log = logging.getLogger(__name__)

ATTACHMENT_EXT = (".xlsx", ".xls", ".pdf", ".doc", ".docx", ".csv")
_LIST_LINK = re.compile(r"danh sach.*(trung tam|ngoai ngu|tin hoc|ky nang|co so giao duc)|"
                        r"(trung tam|ngoai ngu|tin hoc).*(duoc cap phep|duoc phep|cho phep)")

# Từ khóa nhận diện cột (đã bỏ dấu). Thứ tự quan trọng: khóa cụ thể đứng trước.
# Từ bắt đầu bằng "=" phải khớp nguyên ô; còn lại khớp theo cụm từ trong ô.
COLUMNS: list[tuple[str, tuple[str, ...]]] = [
    ("stt", ("=stt", "=tt", "=so tt")),
    ("legal_entity_name", ("don vi chu quan", "cong ty chu quan", "co quan chu quan", "to chuc thanh lap",
                           "chu dau tu", "don vi thanh lap", "ten doanh nghiep", "phap nhan")),
    ("director_name", ("giam doc", "nguoi dung dau", "nguoi dai dien", "ho ten", "ho va ten")),
    ("phone", ("dien thoai", "sdt", "so dt", "hotline", "=lien he")),
    ("license_date", ("ngay cap", "ngay ky", "ngay quyet dinh", "thoi gian cap phep", "ngay cho phep")),
    ("license_number", ("quyet dinh", "so qd", "giay phep", "so hieu")),
    ("address_raw", ("dia chi", "dia diem", "tru so", "noi dat")),
    ("center_name", ("ten trung tam", "ten co so", "ten don vi", "=trung tam", "=ten", "ten goi")),
    ("district", ("quan/huyen", "quan, huyen", "=huyen", "=quan", "huyen (tx, tp)", "huyen (thi xa")),
    ("status_text", ("trang thai", "tinh trang", "ghi chu")),
]
_LICENSE_NO = re.compile(r"(\d{1,6})\s*/\s*((?:Q[\u0110D]|GP)[\w\-/&]*)", re.I)
_DATE = re.compile(r"(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*((?:19|20)\d{2})")


def _cell_matches(folded: str, word: str) -> bool:
    if word.startswith("="):
        return folded == word[1:]
    return f" {word}" in f" {folded}"


@dataclass
class SgdRecord:
    center_name: str
    source_url: str
    province_code: str
    legal_entity_name: str | None = None
    address_raw: str | None = None
    district: str | None = None
    director_name: str | None = None
    phone: str | None = None
    license_number: str | None = None
    license_date: str | None = None
    license_issuer: str | None = None
    status_text: str | None = None
    extra: dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Khám phá link
# ---------------------------------------------------------------------------
def find_links(html: str, base_url: str) -> tuple[list[dict], list[dict]]:
    """→ (file đính kèm, link tới trang danh sách khác)."""
    tree = HTMLParser(html)
    attachments, lists = [], []
    seen = set()
    for a in tree.css("a[href]"):
        href = (a.attributes.get("href") or "").strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
            continue
        url = urljoin(base_url, href)
        if url in seen:
            continue
        seen.add(url)
        text = clean_text(a.text())
        path = urlsplit(url).path.lower()
        if path.endswith(ATTACHMENT_EXT) or re.search(r"\.(xlsx?|pdf|docx?)(?:$|\?|/)", url.lower()):
            attachments.append({"url": url, "text": text, "ext": re.search(r"\.(xlsx?|pdf|docx?|csv)", url.lower()).group(1)})
        elif _LIST_LINK.search(fold(text)):
            lists.append({"url": url, "text": text})
    return attachments, lists


# ---------------------------------------------------------------------------
# Đọc bảng
# ---------------------------------------------------------------------------
def html_tables(html: str) -> list[list[list[str]]]:
    tables = []
    for t in HTMLParser(html).css("table"):
        rows = [[clean_text(c.text(separator=" ")) for c in tr.css("td, th")] for tr in t.css("tr")]
        rows = [r for r in rows if any(r)]
        if len(rows) >= 2:
            tables.append(rows)
    return tables


def xlsx_tables(content: bytes) -> list[list[list[str]]]:
    from openpyxl import load_workbook

    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    tables = []
    for ws in wb.worksheets:
        rows = [[clean_text("" if v is None else str(v)) for v in row] for row in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(r)]
        if rows:
            tables.append(rows)
    return tables


def pdf_tables(content: bytes) -> list[list[list[str]]]:
    import pdfplumber

    rows: list[list[str]] = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                rows.extend([clean_text(c or "") for c in r] for r in table if r and any(r))
    return [rows] if rows else []


def pdf_has_text(content: bytes) -> bool:
    """PDF scan (ảnh) không có lớp chữ → cần OCR, ghi nhận để xử lý tay."""
    import pdfplumber

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        return any((p.extract_text() or "").strip() for p in pdf.pages[:3])


def detect_header(rows: list[list[str]], max_scan: int = 12) -> tuple[int, dict[int, str]] | None:
    """Tìm dòng tiêu đề: dòng có ≥ 2 cột nhận diện được, trong đó có tên trung tâm."""
    for i, row in enumerate(rows[:max_scan]):
        mapping: dict[int, str] = {}
        for j, cell in enumerate(row):
            f = fold(cell)
            if not f or len(f) > 80:
                continue
            for key, words in COLUMNS:
                if key in mapping.values():
                    continue
                if any(_cell_matches(f, w) for w in words):
                    mapping[j] = key
                    break
        if "center_name" in mapping.values() and len(mapping) >= 2:
            return i, mapping
    return None


def parse_license(text: str | None) -> tuple[str | None, str | None]:
    """'QĐ số 1234/QĐ-SGDĐT ngày 12/3/2024' → ('1234/QĐ-SGDĐT', '2024-03-12')."""
    if not text:
        return None, None
    m = _LICENSE_NO.search(text)
    number = f"{m.group(1)}/{m.group(2)}" if m else None
    d = _DATE.search(text)
    date = f"{d.group(3)}-{int(d.group(2)):02d}-{int(d.group(1)):02d}" if d else None
    return number, date


def rows_to_records(rows: list[list[str]], source_url: str, province_code: str,
                    issuer: str | None = None) -> tuple[list[SgdRecord], dict]:
    found = detect_header(rows)
    if not found:
        return [], {"header": None}
    h, mapping = found
    records = []
    for row in rows[h + 1:]:
        values = {key: row[j] for j, key in mapping.items() if j < len(row) and row[j]}
        name = values.get("center_name")
        if not name or fold(name) in ("ten trung tam", "(2)", "2") or re.fullmatch(r"\(?\d+\)?", name):
            continue
        number, date = parse_license(values.get("license_number"))
        number2, date2 = parse_license(values.get("license_date"))
        number = number or number2
        rec = SgdRecord(
            center_name=name, source_url=source_url, province_code=province_code,
            legal_entity_name=values.get("legal_entity_name"), address_raw=values.get("address_raw"),
            district=values.get("district"), director_name=values.get("director_name"),
            phone=normalize_phone(values.get("phone")), license_number=number or values.get("license_number"),
            license_date=date2 or date, license_issuer=issuer, status_text=values.get("status_text"),
        )
        records.append(rec)
    return records, {"header_row": h, "columns": {rows[h][j]: k for j, k in mapping.items()}}


# ---------------------------------------------------------------------------
# Khảo sát (GĐ0): tải trang nguồn, liệt kê định dạng, đọc thử bảng
# ---------------------------------------------------------------------------
def tables_from(content: bytes, content_type: str, url: str) -> tuple[str, list[list[list[str]]], list[str]]:
    lower = url.lower()
    notes = []
    if "pdf" in content_type or lower.endswith(".pdf"):
        if not pdf_has_text(content):
            notes.append("PDF scan không có lớp chữ — cần OCR/xử lý tay")
            return "pdf_scan", [], notes
        return "pdf", pdf_tables(content), notes
    if "spreadsheet" in content_type or lower.endswith((".xlsx", ".xlsm")):
        return "xlsx", xlsx_tables(content), notes
    if lower.endswith((".xls", ".doc", ".docx")):
        notes.append(f"Định dạng {lower.rsplit('.', 1)[-1]} chưa hỗ trợ đọc tự động")
        return lower.rsplit(".", 1)[-1], [], notes
    html = content.decode("utf-8", errors="replace")
    return "html", html_tables(html), notes


def probe_source(client: PoliteClient, url: str, province_code: str, issuer: str,
                 follow: int = 3) -> dict:
    out: dict = {"url": url, "robots_allowed": None, "pages": [], "records": 0, "samples": [], "errors": [],
                 "_records": []}
    try:
        out["robots_allowed"] = client.allowed(url)
        page = client.get(url)
    except FetchError as e:
        out["errors"].append(f"{type(e).__name__}: {e}")
        return out
    queue = [(url, page)]
    if "html" in page.content_type:
        attachments, lists = find_links(page.text, page.final_url)
        out["attachments"] = attachments
        out["list_links"] = lists[:20]
        for att in attachments[:follow]:
            try:
                queue.append((att["url"], client.get(att["url"])))
            except FetchError as e:
                out["errors"].append(f"{att['url']}: {type(e).__name__}: {e}")
    all_records: list[SgdRecord] = []
    for src_url, res in queue:
        fmt, tables, notes = tables_from(res.content, res.content_type, src_url)
        info = {"url": src_url, "format": fmt, "http_status": res.status, "tables": len(tables), "notes": notes}
        for t in tables:
            recs, meta = rows_to_records(t, src_url, province_code, issuer)
            info.setdefault("headers", []).append(meta)
            all_records.extend(recs)
        out["pages"].append(info)
    out["records"] = len(all_records)
    out["samples"] = [asdict(r) for r in all_records[:5]]
    filled = {}
    for key in ("legal_entity_name", "address_raw", "director_name", "phone", "license_number", "license_date"):
        filled[key] = round(sum(1 for r in all_records if getattr(r, key)) / len(all_records), 2) if all_records else None
    out["fill_rate"] = filled
    out["_records"] = all_records
    return out
