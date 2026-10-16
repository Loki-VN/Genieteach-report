"""HTTP lịch sự: robots.txt, ≥2 giây/request/domain, retry backoff, cache thô, phát hiện chặn bot.

Gặp CAPTCHA / trang thử thách chống bot / yêu cầu đăng nhập → ghi log và bỏ qua (BlockedError),
không tìm cách vượt qua.
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import re
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

log = logging.getLogger(__name__)

RETRY_STATUS = {429, 500, 502, 503, 504}
# Dấu hiệu trang thử thách chống bot (Cloudflare, DataDome, PerimeterX, Google sorry…).
_CHALLENGE_MARKERS = re.compile(
    rb"cf-chl-|cf_chl_opt|challenge-platform|captcha-delivery|px-captcha|/sorry/index|"
    rb"g-recaptcha|hcaptcha|turnstile",
    re.I,
)
_CHALLENGE_TITLE = re.compile(
    r"just a moment|attention required|captcha|access denied|verify you are human|request rejected|incapsula|"
    r"x\u00e1c minh|ki\u1ec3m tra b\u1ea3o m\u1eadt",
    re.I,
)
_TITLE = re.compile(rb"<title[^>]*>(.*?)</title>", re.I | re.S)


class FetchError(Exception):
    pass


class BlockedError(FetchError):
    """Trang chặn bot / CAPTCHA / đăng nhập — bỏ qua theo quy tắc."""


class DisallowedError(FetchError):
    """robots.txt không cho phép."""


@dataclass
class FetchResult:
    url: str
    final_url: str
    status: int
    content: bytes
    content_type: str
    fetched_at: str
    from_cache: bool = False

    @property
    def text(self) -> str:
        m = re.search(r"charset=([\w-]+)", self.content_type or "", re.I)
        enc = m.group(1) if m else "utf-8"
        try:
            return self.content.decode(enc, errors="replace")
        except LookupError:
            return self.content.decode("utf-8", errors="replace")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RawCache:
    """Cache nội dung thô theo URL: <dir>/<ab>/<sha1>.bin + .json (metadata)."""

    def __init__(self, root: Path, ttl_days: float):
        self.root = root
        self.ttl = timedelta(days=ttl_days)

    def _paths(self, url: str) -> tuple[Path, Path]:
        h = hashlib.sha1(url.encode("utf-8")).hexdigest()
        d = self.root / h[:2]
        return d / f"{h}.bin", d / f"{h}.json"

    def get(self, url: str) -> FetchResult | None:
        body, meta = self._paths(url)
        if not (body.exists() and meta.exists()):
            return None
        m = json.loads(meta.read_text(encoding="utf-8"))
        if _now() - datetime.fromisoformat(m["fetched_at"]) > self.ttl:
            return None
        return FetchResult(m["url"], m["final_url"], m["status"], body.read_bytes(), m["content_type"],
                           m["fetched_at"], from_cache=True)

    def put(self, r: FetchResult) -> None:
        body, meta = self._paths(r.url)
        body.parent.mkdir(parents=True, exist_ok=True)
        body.write_bytes(r.content)
        meta.write_text(json.dumps({"url": r.url, "final_url": r.final_url, "status": r.status,
                                    "content_type": r.content_type, "fetched_at": r.fetched_at},
                                   ensure_ascii=False), encoding="utf-8")


class PoliteClient:
    def __init__(self, user_agent: str, cache: RawCache | None, *, min_delay: float = 2.0,
                 timeout: float = 30, max_retries: int = 4, backoff_base: float = 2,
                 backoff_max: float = 60, respect_robots: bool = True,
                 transport: httpx.BaseTransport | None = None, sleep=time.sleep):
        self.user_agent = user_agent
        self.cache = cache
        self.min_delay = min_delay
        self.max_retries = max_retries
        self.backoff_base = backoff_base
        self.backoff_max = backoff_max
        self.respect_robots = respect_robots
        self._sleep = sleep
        self._last: dict[str, float] = {}
        self._robots: dict[str, tuple[RobotFileParser | None, str]] = {}
        self._lock = threading.Lock()
        self.client = httpx.Client(headers={"User-Agent": user_agent, "Accept-Language": "vi,en;q=0.8"},
                                   timeout=timeout, follow_redirects=True, transport=transport)

    @classmethod
    def from_config(cls, cfg, **kw) -> "PoliteClient":
        c = cfg["crawl"]
        return cls(cfg.user_agent, RawCache(cfg.path("raw_cache"), c["raw_cache_ttl_days"]),
                   min_delay=c["min_delay_seconds"], timeout=c["timeout_seconds"],
                   max_retries=c["max_retries"], backoff_base=c["backoff_base_seconds"],
                   backoff_max=c["backoff_max_seconds"], respect_robots=c["respect_robots"], **kw)

    # -- rate limit --------------------------------------------------------
    def _wait_turn(self, host: str, delay: float) -> None:
        with self._lock:
            last = self._last.get(host)
            if last is not None:
                remaining = delay - (time.monotonic() - last)
                if remaining > 0:
                    self._sleep(remaining)
            self._last[host] = time.monotonic()

    # -- robots.txt (RFC 9309) ---------------------------------------------
    def robots_status(self, url: str) -> tuple[RobotFileParser | None, str]:
        """Trả về (parser, trạng thái): ok | missing (4xx → cho phép) | unreachable (5xx/lỗi → chặn)."""
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        if origin in self._robots:
            return self._robots[origin]
        robots_url = origin + "/robots.txt"
        try:
            r = self._request(robots_url, check_robots=False, check_block=False)
        except FetchError as e:
            log.warning("robots.txt không truy cập được %s: %s", robots_url, e)
            res: tuple[RobotFileParser | None, str] = (None, "unreachable")
        else:
            if 400 <= r.status < 500:
                res = (None, "missing")
            elif r.status >= 500:
                res = (None, "unreachable")
            else:
                rp = RobotFileParser(robots_url)
                rp.parse(r.text.splitlines())
                res = (rp, "ok")
        self._robots[origin] = res
        return res

    def allowed(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        rp, status = self.robots_status(url)
        if status == "missing":
            return True
        if status == "unreachable":
            return False
        return rp.can_fetch(self.user_agent, url)

    def _delay_for(self, url: str) -> float:
        parts = urlsplit(url)
        cached = self._robots.get(f"{parts.scheme}://{parts.netloc}")
        crawl_delay = None
        if cached and cached[0] is not None:
            crawl_delay = cached[0].crawl_delay(self.user_agent)
        return max(self.min_delay, float(crawl_delay or 0))

    # -- fetch -------------------------------------------------------------
    def get(self, url: str, *, use_cache: bool = True) -> FetchResult:
        if use_cache and self.cache:
            hit = self.cache.get(url)
            if hit:
                self._raise_if_blocked(hit)
                return hit
        r = self._request(url, check_robots=True, check_block=True)
        if self.cache and r.status == 200:
            self.cache.put(r)
        return r

    def _request(self, url: str, *, check_robots: bool, check_block: bool) -> FetchResult:
        if check_robots and not self.allowed(url):
            _, status = self.robots_status(url)
            reason = ("robots.txt không truy cập được (lỗi mạng/5xx) → không crawl theo RFC 9309"
                      if status == "unreachable" else "robots.txt không cho phép")
            raise DisallowedError(f"{reason}: {url}")
        host = urlsplit(url).netloc.lower()
        attempt = 0
        while True:
            self._wait_turn(host, self._delay_for(url))
            try:
                resp = self.client.get(url)
            except httpx.ProxyError as e:      # proxy/chính sách mạng từ chối host: không thử lại
                raise FetchError(f"{url}: proxy từ chối kết nối ({e})") from e
            except httpx.HTTPError as e:
                if attempt >= self.max_retries:
                    raise FetchError(f"{url}: {e!r}") from e
                self._backoff(attempt, None, url, repr(e))
                attempt += 1
                continue
            if resp.status_code in RETRY_STATUS and attempt < self.max_retries:
                self._backoff(attempt, resp.headers.get("Retry-After"), url, str(resp.status_code))
                attempt += 1
                continue
            result = FetchResult(url, str(resp.url), resp.status_code, resp.content,
                                 resp.headers.get("content-type", ""), _now().isoformat())
            if check_block:
                self._raise_if_blocked(result)
            return result

    def _backoff(self, attempt: int, retry_after: str | None, url: str, reason: str) -> None:
        delay = min(self.backoff_max, self.backoff_base * (2 ** attempt)) + random.uniform(0, 0.5)
        if retry_after:
            try:
                delay = max(delay, float(retry_after))
            except ValueError:
                try:
                    delay = max(delay, (parsedate_to_datetime(retry_after) - _now()).total_seconds())
                except (TypeError, ValueError):
                    pass
        log.info("retry %s sau %.1fs (%s)", url, delay, reason)
        self._sleep(min(delay, self.backoff_max))

    @staticmethod
    def _raise_if_blocked(r: FetchResult) -> None:
        if r.status in (401, 407):
            raise BlockedError(f"{r.url}: yêu cầu đăng nhập (HTTP {r.status})")
        m = _TITLE.search(r.content[:20_000])
        title = m.group(1).decode("utf-8", errors="replace") if m else ""
        if _CHALLENGE_TITLE.search(title):
            raise BlockedError(f"{r.url}: trang chống bot/CAPTCHA ({title.strip()[:60]!r})")
        if r.status in (403, 429, 503) and _CHALLENGE_MARKERS.search(r.content[:200_000]):
            raise BlockedError(f"{r.url}: trang chống bot/CAPTCHA (HTTP {r.status})")
        if r.status in (403, 429):
            raise BlockedError(f"{r.url}: bị từ chối (HTTP {r.status})")

    def close(self) -> None:
        self.client.close()
