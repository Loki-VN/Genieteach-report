"""Đơn vị hành chính sau sắp xếp (34 tỉnh/thành, 3.321 xã/phường, từ 01/7/2025).

Chuẩn hóa địa chỉ gốc (thường còn ghi quận/huyện, tỉnh cũ) sang tỉnh mới và xã/phường mới.
Dữ liệu: tcpipe/data/admin_units.json.gz (xem tools/build_admin_units.py).

Lưu ý: bộ ánh xạ xã cũ → xã mới ghi một xã mới cho mỗi xã cũ; với xã cũ bị chia cho
nhiều xã mới, kết quả là xã mới "chính" nên đánh dấu confidence="approximate".
"""
from __future__ import annotations

import gzip
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .normalize import clean_text, fold

DATA = Path(__file__).parent / "data" / "admin_units.json.gz"

# Tên gọi khác thường gặp trong địa chỉ (đã bỏ dấu, chữ thường) → mã tỉnh mới.
EXTRA_ALIASES = {
    "tp hcm": "79", "tp. hcm": "79", "tphcm": "79", "hcm": "79", "sai gon": "79", "saigon": "79",
    "ho chi minh": "79", "ba ria vung tau": "79", "br vt": "79", "brvt": "79", "vung tau": "79",
    "thua thien hue": "46", "tt hue": "46", "hue": "46", "ha noi": "01", "hanoi": "01",
    "dak lak": "66", "daklak": "66", "dak nong": "68", "daknong": "68",
}

_PREFIX = re.compile(r"^(tinh|thanh pho|tp\.?)\s+")


def _bare(name: str) -> str:
    return _PREFIX.sub("", fold(name)).strip()


@dataclass(frozen=True)
class Province:
    code: str
    name: str            # tên chính thức, ví dụ "Thành phố Hà Nội", "Cao Bằng"
    short_name: str      # "Hà Nội", "Cao Bằng"
    kind: str            # "Thành phố Trung Ương" | "Tỉnh"
    merged_from: tuple[str, ...]


@dataclass
class NormalizedAddress:
    address_raw: str
    province_code: str | None
    province_new: str | None
    ward_code: str | None
    ward_new: str | None
    address_normalized: str | None
    method: str          # province_alias | district | none
    confidence: str      # exact | approximate | province_only | none


@lru_cache(maxsize=1)
def _data() -> dict:
    with gzip.open(DATA, "rt", encoding="utf-8") as f:
        d = json.load(f)
    ward_prov = {w[0]: w[2] for w in d["wards"]}
    prov_old: dict[str, set[str]] = {}
    for old_ward, old_district, old_prov, new_code in d["ward_mappings"]:
        prov_old.setdefault(ward_prov[new_code], set()).add(old_prov)
    provinces = {}
    for p in d["provinces"]:
        short = re.sub(r"^Thành phố\s+", "", p["name"])
        provinces[p["code"]] = Province(p["code"], p["name"], short, p["type"],
                                        tuple(sorted(prov_old.get(p["code"], {p["name"]}))))
    # alias (bỏ dấu) → mã tỉnh mới; gồm tên mới, tên tỉnh cũ đã sáp nhập, tên gọi khác.
    aliases: dict[str, str] = {}
    for code, p in provinces.items():
        aliases[_bare(p.name)] = code
        for old in p.merged_from:
            aliases[_bare(old)] = code
    aliases.update(EXTRA_ALIASES)
    # quận/huyện cũ → tập tỉnh mới (chỉ dùng khi duy nhất)
    districts: dict[str, set[str]] = {}
    old_wards: dict[str, list[tuple[str, str, str]]] = {}   # mã tỉnh mới → [(xã cũ, huyện cũ, mã xã mới)]
    for old_ward, old_district, old_prov, new_code in d["ward_mappings"]:
        pcode = ward_prov[new_code]
        if old_district:
            districts.setdefault(fold(old_district), set()).add(pcode)
        if old_ward:
            old_wards.setdefault(pcode, []).append((fold(old_ward), fold(old_district or ""), new_code))
    wards = {w[0]: (w[1], w[2]) for w in d["wards"]}
    new_wards_by_prov: dict[str, list[tuple[str, str]]] = {}
    for code, (name, pcode) in wards.items():
        new_wards_by_prov.setdefault(pcode, []).append((fold(name), code))
    return {"provinces": provinces, "aliases": aliases, "districts": districts,
            "old_wards": old_wards, "wards": wards, "new_wards_by_prov": new_wards_by_prov}


def provinces() -> list[Province]:
    return list(_data()["provinces"].values())


def province_by_code(code: str) -> Province:
    return _data()["provinces"][code]


def resolve_province(name: str | None) -> Province | None:
    """Tên tỉnh (mới hoặc cũ, có/không dấu) → tỉnh mới."""
    if not name:
        return None
    code = _data()["aliases"].get(_bare(name))
    if code is None and re.fullmatch(r"\d{1,2}", name.strip()):
        code = name.strip().zfill(2)
    return _data()["provinces"].get(code) if code else None


def _find_province(folded: str) -> tuple[str | None, int]:
    """Tìm tên tỉnh xuất hiện cuối cùng trong địa chỉ (tỉnh thường đứng cuối)."""
    best, best_pos = None, -1
    for alias, code in _data()["aliases"].items():
        for m in re.finditer(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", folded):
            if m.end() > best_pos:
                best, best_pos = code, m.end()
    return best, best_pos


_ABBREV = [
    (re.compile(r"(?<![a-z])q(?:\.\s*|\s*(?=\d))"), "quan "),
    (re.compile(r"(?<![a-z])h\.\s*"), "huyen "),
    (re.compile(r"(?<![a-z])tx\.?\s+"), "thi xa "),
    (re.compile(r"(?<![a-z])tp\.?\s*(?=[a-z])"), "thanh pho "),
]


def _expand(folded: str) -> str:
    """Mở rộng viết tắt quận/huyện/thị xã/thành phố (Q.3, Q. Cái Răng, TX, TP…)."""
    for pattern, repl in _ABBREV:
        folded = pattern.sub(repl, folded)
    return re.sub(r"quan 0+(\d)", r"quan \1", folded)


def _find_by_district(folded: str) -> str | None:
    for m in re.finditer(r"(quan|huyen|thi xa|thanh pho)\s+([a-z0-9 ]+?)(?=,|-|$)", _expand(folded)):
        key = f"{m.group(1)} {m.group(2).strip()}"
        codes = _data()["districts"].get(key)
        if codes and len(codes) == 1:
            return next(iter(codes))
    return None


_WARD_TOKEN = re.compile(
    r"(?<![a-z])(?P<prefix>phuong|xa|thi tran|dac khu|p\.|x\.|tt\.?)\s*(?P<name>[a-z0-9][a-z0-9 ]*?)\s*(?=,|-|$)"
)
_WARD_PREFIX_FULL = {"p.": "phuong", "x.": "xa", "tt.": "thi tran", "tt": "thi tran"}


def _ward_tokens(folded: str) -> list[tuple[str, int]]:
    """Các cụm 'phường X', 'P.5', 'xã X'… trong địa chỉ → (tên đã chuẩn, vị trí bắt đầu)."""
    out = []
    for m in _WARD_TOKEN.finditer(folded):
        prefix = _WARD_PREFIX_FULL.get(m.group("prefix"), m.group("prefix"))
        name = re.sub(r"^0+(\d)", r"\1", m.group("name"))   # "Phường 05" → "phường 5"
        out.append((f"{prefix} {name}", m.start()))
    return out


def normalize_address(address_raw: str | None, province_hint: str | None = None) -> NormalizedAddress:
    raw = clean_text(address_raw)
    folded = fold(raw)
    d = _data()
    code, method = None, "none"
    if folded:
        code, _ = _find_province(folded)
        method = "province_alias" if code else "none"
        if code is None:
            code = _find_by_district(folded)
            method = "district" if code else "none"
    if code is None and province_hint:
        p = resolve_province(province_hint)
        code, method = (p.code, "hint") if p else (None, "none")
    if code is None:
        return NormalizedAddress(raw, None, None, None, None, None, "none", "none")
    prov = d["provinces"][code]
    ward_code, confidence, cut = None, "province_only", None
    tokens = _ward_tokens(folded)
    if tokens:
        district_names = {m.group(0) for m in
                          re.finditer(r"(quan|huyen|thi xa|thanh pho) [a-z0-9 ]+?(?=,|-|$)", _expand(folded))}
        for token, pos in tokens:
            # 1) địa chỉ đã ghi theo xã/phường mới
            for name, wcode in d["new_wards_by_prov"].get(code, []):
                if name == token:
                    ward_code, confidence, cut = wcode, "exact", pos
                    break
            if ward_code:
                break
            # 2) xã/phường cũ → mới (ưu tiên khớp cả quận/huyện cũ)
            cands = [(dist, wc) for name, dist, wc in d["old_wards"].get(code, []) if name == token]
            if district_names and any(c[0] for c in cands):
                cands = [c for c in cands if c[0] in district_names]
            if len({wc for _, wc in cands}) == 1:
                ward_code, confidence, cut = cands[0][1], "approximate", pos
                break
    ward_new = d["wards"][ward_code][0] if ward_code else None
    if ward_code and cut is not None:
        street = raw[:cut].strip(" ,-")    # fold() giữ nguyên độ dài khi văn bản đã NFC
        parts = [p for p in (street, ward_new, prov.name) if p]
        normalized = ", ".join(parts)
    else:
        normalized = f"{raw}, {prov.name}" if _bare(prov.name) not in folded else raw
    return NormalizedAddress(raw, code, prov.name, ward_code, ward_new, normalized, method, confidence)


def wards_of(province_code: str) -> list[tuple[str, bool]]:
    """Xã/phường mới của tỉnh: (tên, là phường đô thị?)."""
    return [(name, name.startswith("Phường"))
            for name, pcode in _data()["wards"].values() if pcode == province_code]
