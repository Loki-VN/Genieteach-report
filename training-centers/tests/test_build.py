import json

from tcpipe import db
from tcpipe.build import brand_key, build, current_name, parse_other_contacts, split_addresses


def _sgd(conn, name, phone=None, address="Số 1 Lê Lợi, phường Hồng Hải, thành phố Hạ Long", director="Nguyễn Văn A",
         status=None, province="22", in_scope=True, other=None):
    payload = {"center_name": name, "source_url": "https://so.gov.vn/ds.pdf", "province_code": province,
               "address_raw": address, "director_name": director, "phone": phone, "status_text": status,
               "in_scope": in_scope, "other_contact": other, "license_number": "1/QĐ-SGDĐT",
               "extra": {"as_of": "2026-06-30", "list_page": "https://so.gov.vn/tin"}}
    db.add_source_record(conn, "sgd", province, "https://so.gov.vn/ds.pdf", payload)


def test_helpers():
    assert current_name("TT A (QĐ 1/QĐ) Đổi tên thành: Trung tâm B Hạ Long (QĐ 2/QĐ)") == "Trung tâm B Hạ Long"
    assert brand_key("Trung tâm ngoại ngữ Shelton Hạ Long", "22") == "shelton"
    assert brand_key("Trung tâm ngoại ngữ Newlife Uông Bí 1", "22") == "newlife"
    assert [a for _, a in split_addresses("Cơ sở 1: Số 2 Trần Phú, Hạ Long; Cơ sở 2: Số 9 Lê Lợi, Cẩm Phả")] == \
        ["Số 2 Trần Phú, Hạ Long", "Số 9 Lê Lợi, Cẩm Phả"]
    assert parse_other_contacts("Tống Thị Thu Huyền (Giám đốc công ty: 0912 345 678)") == \
        [("Tống Thị Thu Huyền", "0912345678", "Giám đốc công ty")]


def test_build_merges_branches_not_place_suffix(tmp_path, cfg):
    conn = db.connect(tmp_path / "t.sqlite")
    _sgd(conn, "Trung tâm ngoại ngữ Shelton Hạ Long", phone="0912000001")
    _sgd(conn, "Trung tâm ngoại ngữ Shelton Cẩm Phả", address="Số 9 Trần Phú, phường Cẩm Thành, thành phố Cẩm Phả")
    _sgd(conn, "Trung tâm Ngoại ngữ Beeschool Hạ Long", director="Trần Thị B", phone="02033812911",
         status="Dừng hoạt động chưa báo cáo", other="Huyền: 0978437468")
    _sgd(conn, "Văn phòng tư vấn du học X", in_scope=False)
    conn.commit()
    counts = build(conn, cfg)
    assert counts["centers"] == 2
    rows = {r["brand_name"]: r for r in conn.execute("SELECT * FROM centers")}
    shelton = rows["Trung tâm ngoại ngữ Shelton"]
    assert shelton["num_branches"] == 2 and shelton["operating_status"] == "likely_active"  # 1 tín hiệu: có trong DS Sở
    assert json.loads(shelton["source_urls"]) == ["https://so.gov.vn/ds.pdf", "https://so.gov.vn/tin"]
    bee = rows["Trung tâm Ngoại ngữ Beeschool Hạ Long"]
    assert bee["operating_status"] == "closed" and bee["hotline"] == "02033812911"
    contacts = {(r["person_name"], r["phone"]) for r in conn.execute("SELECT * FROM contacts_personal")}
    # giám đốc có SĐT di động + 'liên hệ khác'; SĐT bàn của Beeschool không phải liên hệ cá nhân
    assert contacts == {("Nguyễn Văn A", "0912000001"), ("Huyền", "0978437468")}
    assert all(r["source_url"] for r in conn.execute("SELECT source_url FROM contacts_personal"))
