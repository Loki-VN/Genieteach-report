import json

import httpx
import pytest

from tcpipe import db
from tcpipe.admin_units import wards_of
from tcpipe.sources.google_places import (BudgetExceeded, CostMeter, PlacesClient, estimate_cost, estimate_sweep,
                                          search_mask)


def test_masks_by_tier():
    assert search_mask("ids_only") == "places.id,nextPageToken"
    assert "places.businessStatus" in search_mask("pro") and "places.websiteUri" not in search_mask("pro")
    assert "places.websiteUri" in search_mask("enterprise")


def test_pagination_cost_and_cache(tmp_path, cfg):
    seen = []

    def handler(req):
        body = json.loads(req.content)
        seen.append((req.headers["X-Goog-FieldMask"], body.get("pageToken")))
        if body.get("pageToken") is None:
            return httpx.Response(200, json={"places": [{"id": "p1", "displayName": {"text": "A"}}],
                                             "nextPageToken": "t2"})
        return httpx.Response(200, json={"places": [{"id": "p2", "displayName": {"text": "B"}}]})

    conn = db.connect(tmp_path / "t.sqlite")
    g = cfg["google_places"]
    c = PlacesClient("k", CostMeter(conn, g["pricing"], 10), conn, transport=httpx.MockTransport(handler),
                     min_interval=0)
    ids = [p["id"] for p in c.search_text("trung tâm tiếng Anh Hà Nội", tier="pro")]
    assert ids == ["p1", "p2"] and seen[1][1] == "t2"
    assert db.usage_this_month(conn) == {"text_search_pro": 2}
    assert conn.execute("SELECT COUNT(*) FROM places_cache").fetchone()[0] == 2


def test_budget_guard(cfg):
    pricing = cfg["google_places"]["pricing"]
    m = CostMeter(None, pricing, monthly_budget_usd=0.05)
    m._mem["text_search_enterprise"] = 1000          # đã dùng hết hạn mức miễn phí
    m.charge("text_search_enterprise")                # 0,035 USD ≤ 0,05
    assert m.usage() == {"text_search_enterprise": 1001}
    with pytest.raises(BudgetExceeded):                # 0,07 USD > 0,05 → chặn, không đếm
        m.charge("text_search_enterprise")
    assert m.usage() == {"text_search_enterprise": 1001}


def test_cost_formula(cfg):
    p = cfg["google_places"]["pricing"]
    assert estimate_cost({"text_search_pro": 5000}, p) == 0
    assert estimate_cost({"text_search_pro": 6000}, p) == 32.0
    assert estimate_cost({"text_search_ids_only": 10**6}, p) == 0


def test_sweep_estimate_hanoi(cfg):
    g = cfg["google_places"]
    est = estimate_sweep(cfg["categories"], g["sweep"], {"01": wards_of("01")})
    assert (est["urban_units"], est["rural_units"], est["queries"]) == (51, 75, 15 * 52 + 3 * 75)
