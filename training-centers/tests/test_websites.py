import httpx

from tcpipe.http import PoliteClient, RawCache
from tcpipe.sources.websites import crawl_site

HOME = """<html><head><title>Anh ngữ ABC - Tiếng Anh trẻ em & IELTS</title>
<meta property="article:modified_time" content="2026-09-20T10:00:00+07:00"></head><body>
<nav><a href="/gioi-thieu">Giới thiệu</a><a href="/lien-he">Liên hệ</a><a href="/he-thong-co-so">Hệ thống cơ sở</a>
<a href="/tin-tuc/abc">Tin tức</a></nav>
<p>Hotline: <a href="tel:0912345678">0912.345.678</a></p>
<p>Khóa luyện thi IELTS, lớp học online qua Zoom và học tại trung tâm.</p>
<footer><a href="https://www.facebook.com/AnhNguABC/">Fanpage</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Chia sẻ</a> Email: info@abc.edu.vn</footer>
</body></html>"""
ABOUT = """<html><body><h1>Giới thiệu</h1>
<p>Thành lập năm 2015, ABC đã đào tạo hơn 20.000 học viên.</p>
<p>Giám đốc: Ông Nguyễn Văn Bình - ĐT 0987 654 321 - binh.nguyen@abc.edu.vn</p></body></html>"""
CONTACT = """<html><body><p>Cơ sở 1: Số 12 Trần Thái Tông, Phường Cầu Giấy, Hà Nội</p>
<p>Cơ sở 2: 45 Nguyễn Trãi, Q. Thanh Xuân, Hà Nội</p><p>Cơ sở vật chất hiện đại</p></body></html>"""
PAGES = {"/": HOME, "/gioi-thieu": ABOUT, "/lien-he": CONTACT, "/he-thong-co-so": CONTACT}


def handler(req):
    if req.url.path == "/robots.txt":
        return httpx.Response(200, text="User-agent: *\nAllow: /\n")
    body = PAGES.get(req.url.path)
    if body is None:
        return httpx.Response(404, text="nf")
    return httpx.Response(200, text=body, headers={"content-type": "text/html; charset=utf-8"})


def client(tmp_path, h=handler):
    return PoliteClient("TestBot", RawCache(tmp_path, 1), transport=httpx.MockTransport(h), sleep=lambda s: None)


def test_crawl_site_extracts_org_and_personal_contacts(tmp_path, cfg):
    r = crawl_site(client(tmp_path), "https://abc.edu.vn/", cfg["categories"])
    assert r.alive and not r.parked
    assert "https://abc.edu.vn/tin-tuc/abc" not in r.pages
    assert [p for p, _ in r.phones] == ["0912345678"]
    assert [e for e, _ in r.emails] == ["info@abc.edu.vn"]
    assert r.fanpage_urls == ["https://www.facebook.com/AnhNguABC"]
    assert [a for a, _ in r.branch_addresses] == ["Số 12 Trần Thái Tông, Phường Cầu Giấy, Hà Nội",
                                                  "45 Nguyễn Trãi, Q. Thanh Xuân, Hà Nội"]
    (person,) = r.persons
    assert person["name"] == "Nguyễn Văn Bình" and person["title"] == "Giám đốc"
    assert person["phone"] == "0987654321" and person["email"] == "binh.nguyen@abc.edu.vn"
    assert person["source_url"].endswith("/gioi-thieu")
    assert r.founded_year == 2015 and r.last_activity_date == "2026-09-20"
    assert r.category in ("ngoai_ngu", "luyen_thi") and "IELTS" in r.subjects
    assert r.delivery_mode == "hybrid"
    assert any(c.kind == "learners_cumulative" and c.value == 20000 for c in r.claims)


def test_parked_domain(tmp_path, cfg):
    def parked(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, text="<html><title>abc.edu.vn</title>This domain is for sale! Buy this domain</html>",
                              headers={"content-type": "text/html"})
    r = crawl_site(client(tmp_path, parked), "https://abc.edu.vn/", cfg["categories"])
    assert r.parked and r.alive is False


def test_person_requires_vietnamese_surname_or_honorific():
    from tcpipe.sources.websites import _persons
    text = ("Đồng sáng lập Apollo English. Hiệu trưởng Trường Phổ thông ABC. CEO Lê Đình Lực.\n"
            "Founder Mr. John Smith")
    assert [(p["name"], p["title"]) for p in _persons(text, "u")] == [("Lê Đình Lực", "CEO"), ("John Smith", "Founder")]
