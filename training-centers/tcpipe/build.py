"""Gộp bản ghi thô (source_records) thành bảng centers / branches / contacts_personal.

Khử trùng lặp (union-find), theo thứ tự khóa:
  1. MST trùng nhau
  2. domain website trùng nhau
  3. SĐT trùng nhau VÀ tên tương tự (≥ 60) — SĐT trong danh sách Sở thường là số của giám đốc,
     một người có thể đứng tên nhiều trung tâm khác nhau nên không gộp chỉ vì trùng SĐT
  4. tên thương hiệu tương tự (token_set_ratio ≥ 92) trong cùng tỉnh
Tên thương hiệu bỏ phần "chi nhánh …/cơ sở …" để gộp các chi nhánh về một thương hiệu.
"""
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from collections import defaultdict
from datetime import date
from pathlib import Path

from rapidfuzz import fuzz, process

from .admin_units import normalize_address, province_by_code, strip_location_suffix
from .classify import CATEGORY_LABELS, classify_subjects
from .crawl import domain_matches_brand, email_domain
from .normalize import SURNAMES, clean_text, fold, is_mobile, is_role_email, name_key, normalize_phone, website_domain
from .scale import Claim, estimate_scale
from .sources.sgd import parse_license
from .status import StatusSignals, decide_status

_BRANCH_SUFFIX = re.compile(r"\s*[-–(,]?\s*\b(chi nhanh|co so|cs)\b.*$")
_ADDR_SEGMENT = re.compile(r"(tru so chinh|co so\s*\d*|dia diem\s*\d*|cs\s*\d+|chi nhanh\s*\d*)\s*[:\-–]\s*")
_STATUS_REVOKED = re.compile(r"giai the|thu hoi|dung hoat dong|ngung hoat dong|dung hd")
_STATUS_SUSPENDED = re.compile(r"dinh chi|tam dung|tam ngung")


_RENAMED = re.compile(r"(?i)đổi tên thành\s*:?\s*")
_PAREN = re.compile(r"\([^)]*\)")


def current_name(name: str) -> str:
    """'TT A (QĐ…) Đổi tên thành: TT B (QĐ…)' → 'TT B'; bỏ ghi chú trong ngoặc."""
    parts = _RENAMED.split(name)
    return clean_text(_PAREN.sub(" ", parts[-1])).strip(" .;,-")


def brand_name(name: str, province_code: str | None = None) -> str:
    """Tên thương hiệu: tên hiện hành, bỏ phần 'chi nhánh …/cơ sở …'."""
    name = current_name(name)
    m = _BRANCH_SUFFIX.search(fold(name))
    return clean_text(name[: m.start()] if m and m.start() > 5 else name)


def _person_like(key: str) -> bool:
    """Khóa giống họ tên người ('nguyen van hai'): tên khác nhau một chữ là người khác, không so mờ."""
    words = key.split()
    return 2 <= len(words) <= 5 and words[0] in SURNAMES


def brand_key(name: str, province_code: str | None = None) -> str:
    """Khóa so khớp: bỏ từ chung (trung tâm, ngoại ngữ…) và địa danh ở cuối tên.

    Tên người ('Hộ kinh doanh Nguyễn Xuân Thủy') giữ nguyên: tên đệm + tên hay trùng tên xã ('Xuân Thủy').
    """
    key = re.sub(r"(\s+\d+)+$", "", name_key(brand_name(name, province_code)))   # "newlife uong bi 1"
    return key if _person_like(key) else strip_location_suffix(key, province_code)


def _similar(a: str, b: str, threshold: int) -> bool:
    if not a or not b or min(len(a), len(b)) < 3:
        return False
    return max(fuzz.token_sort_ratio(a, b), fuzz.ratio(a.replace(" ", ""), b.replace(" ", ""))) >= threshold


def display_brand(name: str, province_code: str | None) -> str:
    """Tên hiển thị cho thương hiệu có nhiều cơ sở: bỏ địa danh/số thứ tự ở cuối ('Ocean Edu Mạo Khê' → 'Ocean Edu')."""
    words = name.split()
    folded = fold(name).split()
    while folded and folded[-1].isdigit():
        words, folded = words[:-1], folded[:-1]
    kept = strip_location_suffix(" ".join(folded), province_code).split()
    return " ".join(words[: len(kept)]) if len(kept) >= 3 else " ".join(words)


def split_addresses(address: str | None) -> list[tuple[str | None, str]]:
    """'Cơ sở 1: A; Cơ sở 2: B' → [('Cơ sở 1', 'A'), ('Cơ sở 2', 'B')]; không có nhãn → [(None, địa chỉ)]."""
    if not address:
        return []
    text = clean_text(address)
    f = fold(text)
    marks = list(_ADDR_SEGMENT.finditer(f))
    if not marks:
        return [(None, text.strip(" ;,."))]
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        seg = text[m.end():end].strip(" ;,.")
        if len(seg) >= 6:
            out.append((clean_text(text[m.start():m.end()]).strip(" :-–"), seg))
    return out or [(None, text)]


def _cid(*parts: str) -> str:
    return "C" + hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:10]


class _UF:
    def __init__(self, n: int):
        self.p = list(range(n))

    def find(self, i: int) -> int:
        while self.p[i] != i:
            self.p[i] = self.p[self.p[i]]
            i = self.p[i]
        return i

    def union(self, a: int, b: int) -> None:
        self.p[self.find(a)] = self.find(b)


_LANGS = {"anh", "trung", "nhat", "han", "phap", "duc", "nga", "thai", "lao"}
_CONTENT_COL = re.compile(r"noi dung|mon|ngon ngu|chuong trinh|ky nang dao tao|linh vuc")
# Cột "Loại hình" / tiêu đề phần trong danh sách Sở → loại hình nghiên cứu (dùng trước khi đoán theo từ khóa)
_TYPE_CATEGORY = [
    (re.compile(r"\bkns\b|ky nang song|giao duc ky nang|ngoai gio chinh khoa|toan tu duy|\bttd\b"), "ky_nang"),
    (re.compile(r"\bstem\b|robot|lap trinh"), "tin_hoc_stem"),
    (re.compile(r"boi duong kien thuc|boi duong van hoa|day them|luyen thi"), "luyen_thi"),
]


# Danh sách TT NN-TH → ngoại ngữ (đa số), kỹ năng sống → kỹ năng, cơ sở dạy thêm (TT 29/2024) → luyện thi/bồi dưỡng
_LIST_KIND_CATEGORY = {"ngoai_ngu_tin_hoc": "ngoai_ngu", "ky_nang": "ky_nang", "day_them": "luyen_thi"}
_LANG_NAME = re.compile(r"ngoai ngu|anh ngu|anh van|nhat ngu|han ngu|hoa van|hoa ngu|\bnn\b|\bnnth\b|\bttnn|"
                        r"tieng (?:anh|trung|nhat|han|phap|duc)|english|language")


def _language_first(name: str, category: str) -> str:
    """'Trung tâm Ngoại ngữ - Tin học X' (Sở cấp phép TT NN-TH): tên nêu ngoại ngữ trước tin học → ngoại ngữ."""
    f = fold(name)
    m = _LANG_NAME.search(f)
    if not m:
        return category
    th = f.find("tin hoc")
    return "ngoai_ngu" if th < 0 or m.start() < th else category


def sgd_text(r: dict) -> str:
    """Chữ dùng để phân loại một dòng Sở: tên, phạm vi, loại hình, phần, cột nội dung ('Anh' → 'tiếng Anh')."""
    extra = r.get("extra") or {}
    parts = [r.get("center_name") or "", r.get("scope") or "", extra.get("center_type") or ""]
    for k, v in (extra.get("other_columns") or {}).items():
        if _CONTENT_COL.search(fold(k)):
            parts += [f"tiếng {w}" if fold(w) in _LANGS else w for w in re.split(r"[,;/]\s*", v)]
    return " ".join(parts)


def sgd_type_category(r: dict) -> str | None:
    extra = r.get("extra") or {}
    f = fold(f"{extra.get('center_type') or ''} | {extra.get('section') or ''}")
    return next((cat for rx, cat in _TYPE_CATEGORY if rx.search(f)), None)


def _license_state(status_text: str | None) -> str:
    f = fold(status_text)
    if _STATUS_SUSPENDED.search(f):
        return "suspended"
    if _STATUS_REVOKED.search(f):
        return "revoked"
    return "listed"


SEEDS_FILE = Path(__file__).resolve().parent.parent / "seeds" / "websites.json"


def _seed_hints() -> dict[str, dict]:
    if not SEEDS_FILE.exists():
        return {}
    return {e["url"]: {k: e.get(k) for k in ("province_hint", "brand_hint", "category_hint", "discovered_from")}
            for e in json.loads(SEEDS_FILE.read_text(encoding="utf-8"))}


def _items(conn: sqlite3.Connection) -> list[dict]:
    """Chuẩn hóa mỗi bản ghi nguồn về một dạng chung để khử trùng lặp."""
    items = []
    seeds = _seed_hints()
    for row in conn.execute("SELECT record_id, source, province, source_url, payload, fetched_at FROM source_records "
                            "WHERE source IN ('sgd', 'website') ORDER BY record_id"):
        p = json.loads(row["payload"])
        base = {"record_id": row["record_id"], "source": row["source"], "province": row["province"],
                "source_url": row["source_url"], "fetched_at": row["fetched_at"], "raw": p}
        if row["source"] == "sgd":
            if not p.get("in_scope", True):
                continue
            key = brand_key(p["center_name"], row["province"])
            dom = email_domain(p.get("email"))
            tax = re.sub(r"\s", "", str((p.get("extra") or {}).get("tax_code") or ""))
            base.update(name=brand_name(p["center_name"]), key=key,
                        phones=[p["phone"]] if p.get("phone") else [],
                        tax=tax if re.fullmatch(r"\d{10}(-\d{3})?", tax) else None,
                        domain=dom if dom and domain_matches_brand(dom, key) else None)
        else:
            for k, v in seeds.get(p["url"], {}).items():     # gợi ý từ seeds/websites.json cho bản ghi cũ
                if p.get(k) is None:
                    p[k] = v
            base["raw"] = p
            name = site_brand(p)
            prov = site_province(p) or p.get("province_hint")
            base.update(name=clean_text(name), key=strip_location_suffix(name_key(name), prov),
                        phones=[x for x, _ in p.get("phones", [])][:3],
                        tax=(p.get("tax_codes") or [None])[0], domain=website_domain(p.get("final_url") or p["url"]),
                        province=prov)
        items.append(base)
    return items


def site_brand(p: dict) -> str:
    """Tên thương hiệu của website: og:site_name, nếu không có thì đoạn tiêu đề giống domain nhất."""
    domain = (website_domain(p.get("final_url") or p["url"]) or "").split(".")[0]
    if p.get("site_name") and len(p["site_name"]) <= 60:
        return p["site_name"]
    segments = [seg.strip() for seg in re.split(r"\s+[-|–:]\s+|,\s+", p.get("title") or "") if seg.strip()]
    if not segments:
        return domain
    best = max(segments, key=lambda seg: fuzz.partial_ratio(domain, fold(seg).replace(" ", "")))
    return best if fuzz.partial_ratio(domain, fold(best).replace(" ", "")) >= 60 else segments[0]


_AREA_CODES = {"024": "01", "028": "79"}     # đầu số cố định Hà Nội / TP.HCM


def site_province(p: dict) -> str | None:
    """Tỉnh của website: theo địa chỉ cơ sở ghi trên site; nếu không có thì theo đầu số máy bàn 024/028."""
    codes = [normalize_address(a).province_code for a, _ in p.get("branch_addresses", [])]
    codes = [c for c in codes if c]
    if not codes:
        codes = [_AREA_CODES[x[:3]] for x, _ in p.get("phones", []) if x[:3] in _AREA_CODES]
    return max(set(codes), key=codes.count) if codes else None


def _group(items: list[dict]) -> list[list[dict]]:
    """Union-find theo chỉ mục (MST, domain, SĐT, tỉnh) thay vì so từng cặp — đủ nhanh cho cả nước."""
    uf = _UF(len(items))
    by_tax, by_domain, by_phone, by_prov = (defaultdict(list) for _ in range(4))
    for i, it in enumerate(items):
        if it["tax"]:
            by_tax[it["tax"]].append(i)
        if it["domain"]:
            by_domain[it["domain"]].append(i)
        for ph in set(it["phones"]):
            by_phone[ph].append(i)
        by_prov[it["province"]].append(i)
    for idx in [*by_tax.values(), *by_domain.values()]:
        for j in idx[1:]:
            uf.union(idx[0], j)
    person = [_person_like(it["key"]) for it in items]
    for idx in by_phone.values():
        for n, i in enumerate(idx):
            for j in idx[n + 1:]:
                if _similar(items[i]["key"], items[j]["key"], 92 if person[i] or person[j] else 60):
                    uf.union(i, j)
    for idx in by_prov.values():
        keys = [items[i]["key"] or "" for i in idx]
        if len(keys) < 2:
            continue
        a = process.cdist(keys, keys, scorer=fuzz.token_sort_ratio, workers=-1)
        nospace = [k.replace(" ", "") for k in keys]
        b = process.cdist(nospace, nospace, scorer=fuzz.ratio, workers=-1)
        for n in range(len(idx)):
            if len(keys[n]) < 3:
                continue
            for m in range(n + 1, len(idx)):
                if len(keys[m]) < 3:
                    continue
                if person[idx[n]] or person[idx[m]]:       # hộ kinh doanh đứng tên người: chỉ gộp khi trùng tên
                    if keys[n] == keys[m]:
                        uf.union(idx[n], idx[m])
                elif a[n, m] >= 92 or b[n, m] >= 92:
                    uf.union(idx[n], idx[m])
    groups: dict[int, list[dict]] = {}
    for i, it in enumerate(items):
        groups.setdefault(uf.find(i), []).append(it)
    return list(groups.values())


def _first(values):
    return next((v for v in values if v), None)


def build(conn: sqlite3.Connection, cfg, today: date | None = None) -> dict[str, int]:
    """Dựng lại toàn bộ centers/branches/contacts_personal từ source_records."""
    today = today or date.today()
    categories, scale_params = cfg["categories"], cfg["scale"]
    recent = cfg["status"]["recent_activity_months"]
    conn.execute("DELETE FROM contacts_personal")
    conn.execute("DELETE FROM branches")
    conn.execute("DELETE FROM centers")
    conn.execute("UPDATE source_records SET center_id = NULL")
    counts = {"centers": 0, "branches": 0, "contacts_personal": 0}
    used_ids: set[str] = set()
    for group in _group(_items(conn)):
        sgd = [g for g in group if g["source"] == "sgd"]
        web = [g for g in group if g["source"] == "website"]
        lead = (sgd or web)[0]
        cid = _cid(lead["province"] or "", fold(lead["raw"].get("center_name") or lead["name"]),
                   fold(lead["raw"].get("address_raw") or lead["source_url"]))
        while cid in used_ids:                    # 2 dòng giống hệt nhau mà không gộp được
            cid += "x"
        used_ids.add(cid)
        provs = [g["province"] for g in sgd if g["province"]] or [g["province"] for g in web if g["province"]]
        prov_code = max(dict.fromkeys(provs), key=provs.count) if provs else None   # tỉnh có nhiều cơ sở nhất
        province = province_by_code(prov_code).name if prov_code else None
        source_urls = list(dict.fromkeys(
            [g["source_url"] for g in group] + [g["raw"].get("extra", {}).get("list_page") for g in sgd if g["raw"].get("extra")]
        ))
        source_urls = [u for u in source_urls if u]

        # --- chi nhánh ---------------------------------------------------
        branches: list[dict] = []
        seen_addr: set[str] = set()
        for g in sgd:
            r = g["raw"]
            for label, addr in split_addresses(r.get("address_raw")):
                if fold(addr) in seen_addr:
                    continue
                seen_addr.add(fold(addr))
                n = normalize_address(addr, province)
                branches.append({"branch_name": f"{r['center_name']}" + (f" — {label}" if label else ""),
                                 "address_raw": addr, "address_normalized": n.address_normalized,
                                 "province_new": n.province_new or province, "ward_new": n.ward_new,
                                 "phone": r.get("phone"), "source_url": g["source_url"]})
        for g in web:
            for addr, url in g["raw"].get("branch_addresses", []):
                if fold(addr) in seen_addr:
                    continue
                seen_addr.add(fold(addr))
                n = normalize_address(addr, province)
                branches.append({"branch_name": g["name"], "address_raw": addr,
                                 "address_normalized": n.address_normalized, "province_new": n.province_new,
                                 "ward_new": n.ward_new, "phone": None, "source_url": url})

        # --- phân loại -----------------------------------------------------
        text = " ".join(sgd_text(g["raw"]) for g in sgd)
        typed = _first(sgd_type_category(g["raw"]) for g in sgd)
        if typed:
            category, subjects = typed, classify_subjects(text, categories, title=lead["name"])[1]
        elif web:
            category, subjects = web[0]["raw"].get("category") or "khac", web[0]["raw"].get("subjects") or []
            if category == "khac" and sgd:
                category, subjects = classify_subjects(text, categories, title=lead["name"])
        else:
            category, subjects = classify_subjects(text, categories, title=lead["name"])
        if sgd and category in ("tin_hoc_stem", "khac"):
            category = _language_first(lead["name"], category)
        if category == "khac" and sgd and re.search(r"ngoai ngu|anh ngu|\bnn\b|language|english", fold(text)):
            category = "ngoai_ngu"
        if category == "khac":                             # theo loại danh sách Sở mà trung tâm có tên
            category = _first(_LIST_KIND_CATEGORY.get((g["raw"].get("extra") or {}).get("list_kind")) for g in sgd) \
                or category
        if category == "khac" and web and web[0]["raw"].get("category_hint") in CATEGORY_LABELS:
            category = web[0]["raw"]["category_hint"]      # loại hình ghi trong danh sách chuỗi (seeds/websites.json)
        if web and web[0]["raw"].get("delivery_mode", "unknown") != "unknown":
            mode, mode_ev = web[0]["raw"]["delivery_mode"], web[0]["raw"]["delivery_mode_evidence"]
        elif sgd:
            mode, mode_ev = "offline", "Có địa điểm hoạt động trong danh sách cấp phép của Sở GD&ĐT"
        else:
            mode, mode_ev = "unknown", ""

        # --- liên hệ tổ chức ----------------------------------------------
        hotline = _first([g["raw"].get("phone") for g in sgd] + [x for g in web for x, _ in g["raw"].get("phones", [])])
        emails = [g["raw"].get("email") for g in sgd] + [x for g in web for x, _ in g["raw"].get("emails", [])]
        emails = [e for e in emails if e]
        general_email = _first([e for e in emails if is_role_email(e)]) or _first(emails)
        website = _first(g["raw"].get("final_url") for g in web)
        fanpage = _first(_best_fanpage(g) for g in web)

        # --- người đại diện -----------------------------------------------
        lead_sgd = _first(g["raw"] for g in sgd if g["raw"].get("director_name"))
        web_person = _first(p for g in web for p in g["raw"].get("persons", []))
        owner_name = lead_sgd["director_name"] if lead_sgd else (web_person or {}).get("name")
        owner_title = director_title(lead_sgd) if lead_sgd else (web_person or {}).get("title")

        # --- quy mô ----------------------------------------------------------
        claims = [Claim(**c) for g in web for c in g["raw"].get("claims", [])]
        founded = _first(g["raw"].get("founded_year") for g in web)
        scale = estimate_scale(claims, scale_params, category=category, num_branches=len(branches) or None,
                               founded_year=founded, today=today)

        # --- tình trạng -----------------------------------------------------
        states = [(_license_state(g["raw"].get("status_text")), g["raw"].get("extra", {}).get("as_of")) for g in sgd]
        license_state = next((s for s, _ in states if s != "listed"), "listed" if states else None)
        as_of = _first(a for _, a in states)
        last_activity = _first(g["raw"].get("last_activity_date") for g in web)
        expiries = [parse_license(g["raw"].get("extra", {}).get("license_expiry"))[1] for g in sgd]
        expiry = max((e for e in expiries if e), default=None)
        status, status_ev = decide_status(StatusSignals(
            license_expiry=date.fromisoformat(expiry) if expiry else None,
            license_state=license_state, license_list_date=date.fromisoformat(as_of) if as_of else None,
            website_alive=True if web else None,
            last_activity_date=date.fromisoformat(last_activity) if last_activity else None,
        ), recent, today)
        notes = "; ".join(dict.fromkeys(g["raw"].get("status_text") for g in sgd if g["raw"].get("status_text")))
        if notes:
            status_ev += f" | Ghi chú của Sở: {notes}"

        licenses = list(dict.fromkeys(g["raw"].get("license_number") for g in sgd if g["raw"].get("license_number")))
        hq = branches[0] if branches else {}
        fetched = sorted(g["fetched_at"] for g in group)
        conn.execute(
            "INSERT INTO centers VALUES (" + ",".join("?" * 30) + ")",
            (cid, display_brand(lead["name"], prov_code) if len(group) > 1 else lead["name"],
             _first(g["raw"].get("legal_entity_name") for g in sgd),
             _first(g["tax"] for g in group), CATEGORY_LABELS[category], json.dumps(subjects, ensure_ascii=False),
             mode, mode_ev, province or hq.get("province_new"), hq.get("address_normalized") or hq.get("address_raw"),
             len(branches) or None, website, fanpage, hotline, general_email, owner_name, owner_title,
             scale.estimate, scale.bucket, scale.evidence, scale.confidence, status, status_ev, last_activity,
             "; ".join(licenses) or None, _first(g["raw"].get("license_date") for g in sgd),
             _first(g["raw"].get("license_issuer") for g in sgd), json.dumps(source_urls, ensure_ascii=False),
             fetched[0], fetched[-1]),
        )
        counts["centers"] += 1
        for b in branches:
            conn.execute("INSERT INTO branches(center_id, branch_name, address_raw, address_normalized, province_new, "
                         "ward_new, phone, place_id, source_url) VALUES (?,?,?,?,?,?,?,?,?)",
                         (cid, b["branch_name"], b["address_raw"], b["address_normalized"], b["province_new"],
                          b["ward_new"], b["phone"], None, b["source_url"]))
            counts["branches"] += 1
        for person in _contacts(sgd, web):
            conn.execute("INSERT INTO contacts_personal(center_id, person_name, title, phone, email, source_url, "
                         "collected_at) VALUES (?,?,?,?,?,?,?)", (cid, *person))
            counts["contacts_personal"] += 1
        conn.executemany("UPDATE source_records SET center_id=? WHERE record_id=?",
                         [(cid, g["record_id"]) for g in group])
    conn.commit()
    return counts


def _best_fanpage(site_item: dict) -> str | None:
    """Fanpage khớp tên thương hiệu/domain nhất; bỏ link tới trang cá nhân (ví dụ lời chứng thực)."""
    domain = (site_item["domain"] or "").split(".")[0]
    best, score = None, 0
    for url in site_item["raw"].get("fanpage_urls", []):
        handle = fold(url.rsplit("/", 1)[-1])
        s = max(fuzz.partial_ratio(handle, domain), fuzz.partial_ratio(handle, site_item["key"].replace(" ", "")))
        if s > score:
            best, score = url, s
    return best if score >= 60 else None


_OTHER_CONTACT = re.compile(r"(?P<label>[^;,\n]*?)[\s:(]*(?P<phone>(?:\+?84|0)[\d .]{8,12}\d)")


def director_title(r: dict) -> str:
    """Chức danh của người đứng tên trong danh sách Sở: giám đốc trung tâm, hoặc chủ cơ sở dạy thêm (TT 29/2024)."""
    if (r.get("extra") or {}).get("list_kind") == "day_them":
        return "Chủ cơ sở/người đăng ký dạy thêm (danh sách Sở GD&ĐT công bố)"
    return "Giám đốc/người đứng đầu (danh sách Sở GD&ĐT)"


def parse_other_contacts(text: str) -> list[tuple[str, str, str | None]]:
    """'Tống Thị Thu Huyền (Giám đốc công ty: 0912…)', 'Huyền: 0978…' → [(tên, sđt, ghi chú chức danh)]."""
    out = []
    for m in _OTHER_CONTACT.finditer(clean_text(text)):
        phone = normalize_phone(m.group("phone"))
        label = m.group("label")
        name = clean_text(re.sub(r"(?i)^\s*liên hệ\s*", "", label.split("(")[0])).strip(" -:")
        role = "Giám đốc công ty" if "giam doc" in fold(label) else None
        if phone and name and len(name) <= 40:
            out.append((name, phone, role))
    return out


def _contacts(sgd: list[dict], web: list[dict]) -> list[tuple]:
    out, seen = [], set()

    def add(name, title, phone, email, url, at):
        key = (fold(name), phone, email)
        if name and (phone or email) and key not in seen:
            seen.add(key)
            out.append((name, title, phone, email, url, at))

    for g in sgd:
        r = g["raw"]
        if r.get("director_name") and r.get("phone") and is_mobile(r["phone"]):
            add(r["director_name"], director_title(r), r["phone"], None,
                g["source_url"], g["fetched_at"])
        for name, phone, role in parse_other_contacts(r.get("other_contact") or ""):
            add(name, f"{role or 'Liên hệ khác'} (danh sách Sở GD&ĐT)", phone, None, g["source_url"], g["fetched_at"])
    for g in web:
        for p in g["raw"].get("persons", []):
            add(p["name"], p["title"], p.get("phone"), p.get("email"), p["source_url"], g["fetched_at"])
    return out
