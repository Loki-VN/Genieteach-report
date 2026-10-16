"""Đóng gói dữ liệu đơn vị hành chính 34 tỉnh / 3.321 xã vào tcpipe/data/admin_units.json.gz.

Nguồn: https://github.com/quangtam/vietnam-address-database (MIT), file address.json,
dựa trên Nghị quyết 202/2025/QH15 và các nghị quyết sắp xếp ĐVHC cấp xã.

    python tools/build_admin_units.py /path/to/vietnam-address-database/address.json
"""
from __future__ import annotations

import gzip
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "tcpipe" / "data" / "admin_units.json.gz"


def main(src: str) -> None:
    sections = {s.get("name"): s for s in json.loads(Path(src).read_text(encoding="utf-8")) if isinstance(s, dict)}
    provinces = [
        {"code": p["province_code"], "name": p["name"], "short_code": p["code"], "type": p["place_type"]}
        for p in sections["provinces"]["data"]
    ]
    wards = [[w["ward_code"], w["name"], w["province_code"]] for w in sections["wards"]["data"]]
    # Một số quy tắc bổ sung (15/7/2025) ghi mã xã mới không có trong bảng xã:
    # tra lại theo tên xã mới + tỉnh mới.
    codes = {w[0] for w in wards}
    prov_code = {p["name"]: p["code"] for p in provinces}
    by_name = {(w[1], w[2]): w[0] for w in wards}
    mappings = []
    for m in sections["ward_mappings"]["data"]:
        if not m["old_province_name"]:
            continue
        code = m["new_ward_code"]
        if code not in codes:
            code = by_name.get((m["new_ward_name"], prov_code[m["new_province_name"]]))
            if code is None:
                print("bỏ qua quy tắc không tra được xã mới:", m["old_ward_name"], "→", m["new_ward_name"])
                continue
        mappings.append([m["old_ward_name"], m["old_district_name"], m["old_province_name"], code])
    payload = {
        "source": "https://github.com/quangtam/vietnam-address-database (MIT)",
        "provinces": provinces,
        "wards": wards,
        "ward_mappings_columns": ["old_ward", "old_district", "old_province", "new_ward_code"],
        "ward_mappings": mappings,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{OUT}: {len(provinces)} tỉnh, {len(wards)} xã/phường, {len(mappings)} quy tắc ánh xạ")


if __name__ == "__main__":
    main(sys.argv[1])
