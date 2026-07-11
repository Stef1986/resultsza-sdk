"""Horse racing endpoints, including the client-side 7-day span guard that
avoids wasting an API call on a request the server would reject with HTTP 400."""
import httpx
import pytest
import respx

from tests.conftest import BASE


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
