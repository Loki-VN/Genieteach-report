from tcpipe.admin_units import normalize_address, provinces, resolve_province, wards_of


def test_34_provinces_and_wards():
    assert len(provinces()) == 34
    assert sum(len(wards_of(p.code)) for p in provinces()) == 3321


def test_resolve_old_province_names():
    assert resolve_province("Bình Dương").code == "79"
    assert resolve_province("Thừa Thiên Huế").code == "46"
    assert resolve_province("ha giang").name == "Tuyên Quang"
    assert set(resolve_province("Phú Thọ").merged_from) == {"Tỉnh Hoà Bình", "Tỉnh Phú Thọ", "Tỉnh Vĩnh Phúc"}


def test_old_ward_to_new_ward():
    r = normalize_address("12 Võ Văn Tần, P.5, Q.3, TP.HCM")
    assert (r.province_code, r.ward_new, r.confidence) == ("79", "Phường Bàn Cờ", "approximate")
    assert r.address_normalized == "12 Võ Văn Tần, Phường Bàn Cờ, Thành phố Hồ Chí Minh"


def test_new_format_address_is_exact():
    r = normalize_address("45 Trần Phú, Phường Ba Đình, Thành phố Hà Nội")
    assert (r.ward_new, r.confidence) == ("Phường Ba Đình", "exact")


def test_province_from_unique_district_only():
    r = normalize_address("Tầng 3, 18 Tam Trinh, Q. Hoàng Mai")
    assert (r.province_code, r.method, r.confidence) == ("01", "district", "province_only")


def test_district_mismatch_does_not_guess_ward():
    r = normalize_address("xã Hòa Bình, huyện Tân Lạc, tỉnh Hòa Bình")
    assert r.province_code == "25" and r.ward_new is None


def test_unknown_address():
    assert normalize_address("abc").confidence == "none"
