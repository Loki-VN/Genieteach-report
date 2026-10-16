import httpx
import pytest

from tcpipe.http import BlockedError, DisallowedError, PoliteClient, RawCache


def make_client(handler, tmp_path, sleeps):
    return PoliteClient("TestBot/0.1", RawCache(tmp_path, 1), min_delay=2.0, backoff_base=2, max_retries=3,
                        transport=httpx.MockTransport(handler), sleep=sleeps.append)


def test_robots_rate_limit_retry_cache(tmp_path):
    calls = {"flaky": 0}

    def handler(req):
        path = req.url.path
        if path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
        if path == "/flaky":
            calls["flaky"] += 1
            return httpx.Response(503 if calls["flaky"] == 1 else 200, text="ok")
        return httpx.Response(200, text="<html><title>Trang</title>hello</html>",
                              headers={"content-type": "text/html; charset=utf-8"})

    sleeps = []
    c = make_client(handler, tmp_path, sleeps)
    with pytest.raises(DisallowedError):
        c.get("https://a.vn/private/x")
    r = c.get("https://a.vn/page")
    assert r.status == 200 and "hello" in r.text
    # mỗi request cùng domain chờ ≥ 2 giây (robots → page)
    assert sleeps and all(s >= 1.9 for s in sleeps)
    n = len(sleeps)
    assert c.get("https://a.vn/page").from_cache and len(sleeps) == n
    assert c.get("https://a.vn/flaky").status == 200 and calls["flaky"] == 2
    assert any(s >= 2 for s in sleeps[n:])


def test_missing_robots_allows_and_5xx_disallows(tmp_path):
    def handler(req):
        if req.url.host == "b.vn" and req.url.path == "/robots.txt":
            return httpx.Response(404)
        if req.url.path == "/robots.txt":
            return httpx.Response(500)
        return httpx.Response(200, text="x")

    c = make_client(handler, tmp_path, [])
    c.max_retries = 0
    assert c.allowed("https://b.vn/a")
    assert not c.allowed("https://c.vn/a")


def test_challenge_page_is_blocked_not_bypassed(tmp_path):
    def handler(req):
        if req.url.path == "/robots.txt":
            return httpx.Response(404)
        if req.url.path == "/cf":
            return httpx.Response(403, text='<html><title>Just a moment...</title><div class="cf-chl-x"></div></html>')
        return httpx.Response(200, text='<html><title>Liên hệ</title><div class="g-recaptcha"></div>form</html>')

    c = make_client(handler, tmp_path, [])
    with pytest.raises(BlockedError):
        c.get("https://d.vn/cf")
    # trang thường có reCAPTCHA ở form liên hệ không bị coi là chặn
    assert c.get("https://d.vn/lien-he").status == 200
