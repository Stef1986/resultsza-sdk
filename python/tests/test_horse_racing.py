"""Horse racing endpoints, including the client-side 7-day span guard that
avoids wasting an API call on a request the server would reject with HTTP 400."""
import httpx
import pytest
import respx

import resultsza.client as client_module
from resultsza.exceptions import ValidationError
from tests.conftest import BASE

MEETINGS = f"{BASE}/api/get_horse_racing_meetings"


@pytest.fixture
def sast_today(monkeypatch):
    """Pin the client's idea of "today" (South African time) to 2026-06-10."""
    from datetime import date

    monkeypatch.setattr(client_module, "_sast_today", lambda: date(2026, 6, 10))


@respx.mock
def test_meetings_sends_date_range(client):
    route = respx.get(f"{BASE}/api/get_horse_racing_meetings").mock(
        return_value=httpx.Response(200, json={"status": "success", "meetings": []})
    )
    client.get_horse_racing_meetings(from_date="2026-06-01", to_date="2026-06-07")
    params = route.calls.last.request.url.params
    assert params["from_date"] == "2026-06-01"
    assert params["to_date"] == "2026-06-07"


@respx.mock
def test_meetings_no_args(client):
    route = respx.get(f"{BASE}/api/get_horse_racing_meetings").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_horse_racing_meetings()
    assert route.called


@respx.mock
def test_meetings_rejects_span_over_7_days_without_calling(client):
    route = respx.get(f"{BASE}/api/get_horse_racing_meetings").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    with pytest.raises(ValueError):
        client.get_horse_racing_meetings(from_date="2026-06-01", to_date="2026-06-10")
    assert not route.called  # guard fired before any HTTP request


@respx.mock
def test_meetings_allows_exact_7_day_span(client):
    respx.get(f"{BASE}/api/get_horse_racing_meetings").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    # from 06-01 to 06-08 is a diff of 7 days - the documented maximum.
    client.get_horse_racing_meetings(from_date="2026-06-01", to_date="2026-06-08")


@respx.mock
def test_meetings_rejects_reversed_range(client):
    with pytest.raises(ValueError):
        client.get_horse_racing_meetings(from_date="2026-06-10", to_date="2026-06-01")


@respx.mock
def test_racecard_requires_date_and_venue(client):
    with pytest.raises(ValueError):
        client.get_horse_racing_results(date="2026-06-03")  # venue missing
    with pytest.raises(ValueError):
        client.get_horse_racing_results(venue="Greyville")  # date missing


@respx.mock
def test_racecard_sends_params(client):
    route = respx.get(f"{BASE}/api/get_horse_racing_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_horse_racing_results(date="2026-06-03", venue="Greyville")
    params = route.calls.last.request.url.params
    assert params["date"] == "2026-06-03"
    assert params["venue"] == "Greyville"


@respx.mock
def test_runner_requires_race_no(client):
    with pytest.raises(ValueError):
        client.get_horse_racing_race(date="2026-06-03", venue="Greyville")


@respx.mock
def test_runner_sends_race_no(client):
    route = respx.get(f"{BASE}/api/get_horse_racing_race").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_horse_racing_race(date="2026-06-03", venue="Greyville", race_no=4)
    params = route.calls.last.request.url.params
    assert params["date"] == "2026-06-03"
    assert params["venue"] == "Greyville"
    assert params["race_no"] == "4"


@respx.mock
def test_meetings_only_from_date_checks_span_against_today(client, sast_today):
    # The server defaults to_date to today, so from_date alone can still
    # exceed the 7-day span.
    route = respx.get(MEETINGS).mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        client.get_horse_racing_meetings(from_date="2026-06-02")  # 8 days before today
    assert not route.called

    client.get_horse_racing_meetings(from_date="2026-06-03")  # exactly 7 days
    params = route.calls.last.request.url.params
    assert params["from_date"] == "2026-06-03"
    assert "to_date" not in params


@respx.mock
def test_meetings_only_from_date_in_future_is_rejected(client, sast_today):
    route = respx.get(MEETINGS).mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        client.get_horse_racing_meetings(from_date="2026-06-11")
    assert not route.called


@respx.mock
def test_meetings_only_to_date_checks_span_against_default_from(client, sast_today):
    # from_date defaults to today minus 7 days (2026-06-03).
    route = respx.get(MEETINGS).mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        client.get_horse_racing_meetings(to_date="2026-06-11")
    with pytest.raises(ValidationError):
        client.get_horse_racing_meetings(to_date="2026-06-02")
    assert not route.called
    client.get_horse_racing_meetings(to_date="2026-06-09")
    assert route.called


def test_sast_today_uses_south_african_time(monkeypatch):
    # 23:30 UTC on 2026-06-09 is already 01:30 on 2026-06-10 in South Africa.
    from datetime import date, datetime, timezone

    class FakeDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(2026, 6, 9, 23, 30, tzinfo=timezone.utc).astimezone(tz)

    monkeypatch.setattr(client_module, "_datetime", FakeDatetime)
    assert client_module._sast_today() == date(2026, 6, 10)


@respx.mock
@pytest.mark.parametrize(
    "kwargs",
    [
        {"from_date": "2026-6-1"},
        {"to_date": "2026/06/07"},
        {"from_date": "2026-02-29", "to_date": "2026-03-01"},  # 2026 is not a leap year
        {"from_date": "2026-06-01", "to_date": "2026-06-31"},
    ],
)
def test_meetings_reject_bad_dates_without_calling(client, kwargs):
    route = respx.get(MEETINGS).mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        client.get_horse_racing_meetings(**kwargs)
    assert not route.called


@respx.mock
def test_racecard_and_runner_reject_bad_dates(client):
    route = respx.get(url__regex=rf"{BASE}/api/get_horse_racing_.*").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    with pytest.raises(ValidationError):
        client.get_horse_racing_results(date="22-06-2026", venue="Greyville")
    with pytest.raises(ValidationError):
        client.get_horse_racing_race(date="2026-13-01", venue="Greyville", race_no=1)
    assert not route.called
