"""Coverage for every lottery result endpoint: correct path, correct params."""
import httpx
import pytest
import respx

from resultsza.exceptions import ValidationError
from tests.conftest import API_KEY, BASE

# (method_name, path) - all take only an optional `date`.
DATE_ONLY = [
    ("get_daily_lotto_results", "/api/get_daily_lotto_results"),
    ("get_lotto_results", "/api/get_lotto_results"),
    ("get_lotto_plus_1_results", "/api/get_lotto_plus_1_results"),
    ("get_lotto_5_max_results", "/api/get_lotto_5_max_results"),
    ("get_sa_powerball_results", "/api/get_sa_powerball_results"),
    ("get_powerball_xtra_results", "/api/get_powerball_xtra_results"),
    ("get_euromillions_results", "/api/get_euromillions_results"),
    ("get_irish_lotto_results", "/api/get_irish_lotto_results"),
    ("get_us_powerball_results", "/api/get_us_powerball_results"),
    ("get_megamillions_results", "/api/get_megamillions_results"),
]


@respx.mock
@pytest.mark.parametrize("method_name,path", DATE_ONLY)
def test_date_only_endpoints(client, method_name, path):
    route = respx.get(f"{BASE}{path}").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    result = getattr(client, method_name)(date="2026-06-03")

    assert result == {"status": "success"}
    params = route.calls.last.request.url.params
    assert params["date"] == "2026-06-03"
    assert params["api_key"] == API_KEY


# --- endpoints with extra params ---------------------------------------


@respx.mock
def test_kenya_lotto_sends_type(client):
    route = respx.get(f"{BASE}/api/get_kenya_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_kenya_lotto_results(date="2026-06-03", draw_type="jackpot")
    params = route.calls.last.request.url.params
    assert params["type"] == "jackpot"
    assert params["date"] == "2026-06-03"


@respx.mock
def test_nigeria_lotto_game_optional(client):
    route = respx.get(f"{BASE}/api/get_nigeria_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_nigeria_lotto_results()  # omit game -> all games
    assert "game" not in route.calls.last.request.url.params

    client.get_nigeria_lotto_results(game="PREMIER PEOPLES")
    assert route.calls.last.request.url.params["game"] == "PREMIER PEOPLES"


@respx.mock
def test_ghana_lotto_game_optional(client):
    route = respx.get(f"{BASE}/api/get_ghana_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_ghana_lotto_results(game="Ghana Monday Special")
    assert route.calls.last.request.url.params["game"] == "Ghana Monday Special"


@respx.mock
def test_uk49s_requires_game(client):
    with pytest.raises(ValueError):
        client.get_uk49s_results(date="2026-06-03")  # game missing


@respx.mock
def test_uk49s_sends_game(client):
    route = respx.get(f"{BASE}/api/get_uk49s_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_uk49s_results(game="UK49s Lunchtime", date="2026-06-03")
    params = route.calls.last.request.url.params
    assert params["game"] == "UK49s Lunchtime"
    assert params["date"] == "2026-06-03"


# --- Gosloto -------------------------------------------------------------

GOSLOTO = [
    ("get_gosloto_6_45_results", "/api/get_gosloto_6_45_results"),
    ("get_gosloto_7_49_results", "/api/get_gosloto_7_49_results"),
    ("get_gosloto_5_36_results", "/api/get_gosloto_5_36_results"),
]


@respx.mock
@pytest.mark.parametrize("method_name,path", GOSLOTO)
def test_gosloto_latest_date_and_draw_id(client, method_name, path):
    route = respx.get(f"{BASE}{path}").mock(
        return_value=httpx.Response(200, json={"status": "success", "results": []})
    )
    method = getattr(client, method_name)

    method()  # latest draw: no optional params sent
    params = route.calls.last.request.url.params
    assert params["api_key"] == API_KEY
    assert "date" not in params and "draw_id" not in params

    method(date="2026-08-06")
    assert route.calls.last.request.url.params["date"] == "2026-08-06"

    method(draw_id=18325)  # ints are sent as strings
    assert route.calls.last.request.url.params["draw_id"] == "18325"


@respx.mock
@pytest.mark.parametrize("method_name,path", GOSLOTO)
def test_gosloto_rejects_bad_date(client, method_name, path):
    route = respx.get(f"{BASE}{path}").mock(return_value=httpx.Response(200, json={}))
    with pytest.raises(ValidationError):
        getattr(client, method_name)(date="06-08-2026")
    assert not route.called


# --- client-side date validation -----------------------------------------

DATE_METHODS = [name for name, _ in DATE_ONLY] + [
    "get_kenya_lotto_results",
    "get_nigeria_lotto_results",
    "get_ghana_lotto_results",
] + [name for name, _ in GOSLOTO]

BAD_DATES = ["2026-6-3", "03/06/2026", "2026-02-30", "2026-06-03T00:00", " 2026-06-03", 20260603]


@respx.mock
@pytest.mark.parametrize("method_name", DATE_METHODS)
@pytest.mark.parametrize("bad", BAD_DATES)
def test_bad_dates_rejected_before_any_request(client, method_name, bad):
    route = respx.route().mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        getattr(client, method_name)(date=bad)
    assert not route.called


@respx.mock
def test_uk49s_rejects_bad_date(client):
    route = respx.route().mock(return_value=httpx.Response(200, json={"status": "success"}))
    with pytest.raises(ValidationError):
        client.get_uk49s_results(game="UK49s Lunchtime", date="2026-02-29")
    assert not route.called


@respx.mock
def test_leap_day_is_a_real_date(client):
    route = respx.get(f"{BASE}/api/get_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.get_lotto_results(date="2028-02-29")
    assert route.calls.last.request.url.params["date"] == "2028-02-29"
