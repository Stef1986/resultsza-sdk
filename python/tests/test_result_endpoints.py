"""Coverage for every lottery result endpoint: correct path, correct params."""
import httpx
import pytest
import respx

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
