"""SA-only checkers: POST with game+date in the query, played_numbers + api_key
in the body, and client-side line-limit guards (10 / 500)."""
import json

import httpx
import pytest
import respx

from tests.conftest import API_KEY, BASE


@respx.mock
def test_check_played_numbers_post_query_and_body(client):
    route = respx.post(f"{BASE}/api/check_played_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.check_played_numbers(
        game="Lotto", date="2026-06-03", played_numbers=[1, 6, 29, 11, 15, 17]
    )
    req = route.calls.last.request
    assert req.method == "POST"
    # api_key, game and date are query params; only played_numbers goes in
    # the JSON body.
    assert req.url.params["game"] == "Lotto"
    assert req.url.params["date"] == "2026-06-03"
    assert req.url.params["api_key"] == API_KEY
    body = json.loads(req.content)
    assert body["played_numbers"] == [1, 6, 29, 11, 15, 17]
    assert "api_key" not in body


def test_check_played_numbers_validates_inputs(client):
    with pytest.raises(ValueError):
        client.check_played_numbers(game="", date="2026-06-03", played_numbers=[1, 2, 3, 4, 5, 6])
    with pytest.raises(ValueError):
        client.check_played_numbers(game="Lotto", date="", played_numbers=[1, 2, 3, 4, 5, 6])
    with pytest.raises(ValueError):
        client.check_played_numbers(game="Lotto", date="2026-06-03", played_numbers=[])


@respx.mock
def test_check_played_numbers_rejects_over_10_lines(client):
    route = respx.post(f"{BASE}/api/check_played_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    eleven = [[1, 2, 3, 4, 5, 6]] * 11
    with pytest.raises(ValueError):
        client.check_played_numbers(game="Lotto", date="2026-06-03", played_numbers=eleven)
    assert not route.called


@respx.mock
def test_bulk_check_rejects_over_500_lines(client):
    route = respx.post(f"{BASE}/api/bulk_check_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    too_many = [[1, 2, 3, 4, 5, 6]] * 501
    with pytest.raises(ValueError):
        client.bulk_check_numbers(game="Lotto", date="2026-06-03", played_numbers=too_many)
    assert not route.called


@respx.mock
def test_bulk_check_ok(client):
    route = respx.post(f"{BASE}/api/bulk_check_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    lines = [[1, 2, 3, 4, 5, 6]] * 50
    client.bulk_check_numbers(game="Lotto", date="2026-06-03", played_numbers=lines)
    req = route.calls.last.request
    assert req.url.params["api_key"] == API_KEY
    body = json.loads(req.content)
    assert body["played_numbers"] == lines
    assert "api_key" not in body
