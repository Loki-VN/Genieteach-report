from tcpipe.normalize import (extract_emails, extract_phones, is_role_email, name_key, normalize_facebook_url,
                              normalize_phone, website_domain)


def test_normalize_phone_formats():
    assert normalize_phone("+84 912 345 678") == "0912345678"
    assert normalize_phone("(024) 3851.2345") == "02438512345"
    assert normalize_phone("1900 6868") == "19006868"
    assert normalize_phone("0912 345") is None


def test_extract_phones_dedup_and_context():
    text = "Hotline: 0912.345.678 - 0912 345 678. ĐT: 028 3822 1234. Mã số thuế 0101234567"
    phones = extract_phones(text)
    assert phones[:2] == ["0912345678", "02838221234"]


def test_emails_role_vs_personal():
    emails = extract_emails("Liên hệ info@abc.edu.vn hoặc nguyenvana@gmail.com, logo@2x.png")
    assert emails == ["info@abc.edu.vn", "nguyenvana@gmail.com"]
    assert is_role_email("tuyensinh.hn@abc.edu.vn")
    assert not is_role_email("nguyenvana@gmail.com")


def test_website_domain_skips_social_and_shared():
    assert website_domain("https://www.ABC.edu.vn/lien-he") == "abc.edu.vn"
    assert website_domain("https://facebook.com/abc") is None
    assert website_domain("https://abc.business.site") is None


def test_facebook_url():
    assert normalize_facebook_url("https://m.facebook.com/AnhNguABC/") == "https://www.facebook.com/AnhNguABC"
    assert normalize_facebook_url("https://www.facebook.com/sharer/sharer.php?u=x") is None
    assert normalize_facebook_url("https://facebook.com/profile.php?id=123&ref=x") == \
        "https://www.facebook.com/profile.php?id=123"


def test_name_key_strips_generic_words():
    assert name_key("Trung tâm Ngoại ngữ Apollo - Cơ sở Cầu Giấy") == name_key("APOLLO English cau giay")
