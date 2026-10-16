from datetime import date

from tcpipe.status import StatusSignals, decide_status

TODAY = date(2026, 10, 1)


def test_registry_closed_wins():
    s = StatusSignals(registry_status="Ngừng hoạt động và đã đóng MST", places_business_status="OPERATIONAL")
    assert decide_status(s, today=TODAY)[0] == "closed"


def test_active_needs_two_signals_one_recent():
    s = StatusSignals(places_business_status="OPERATIONAL", website_alive=True)
    assert decide_status(s, today=TODAY)[0] == "active"
    s = StatusSignals(website_alive=True, registry_status="Đang hoạt động")
    assert decide_status(s, today=TODAY)[0] == "likely_active"


def test_places_closed_without_recent_positive():
    s = StatusSignals(places_business_status="CLOSED_PERMANENTLY", website_alive=True)
    assert decide_status(s, today=TODAY)[0] == "closed"
    s = StatusSignals(places_business_status="CLOSED_PERMANENTLY", last_activity_date=date(2026, 8, 1))
    assert decide_status(s, today=TODAY)[0] == "likely_active"


def test_unknown_and_evidence():
    status, evidence = decide_status(StatusSignals(website_alive=False), today=TODAY)
    assert status == "unknown" and "website" in evidence
