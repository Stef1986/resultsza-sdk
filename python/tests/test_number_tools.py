"""Number generators and analysis tools."""
import json

import httpx
import pytest
import respx

from tests.conftest import API_KEY, BASE


@respx.mock
def test_generate_random_numbers_sends_game_and_lines(client):
    route = respx.get(f"{BASE}/api/generate_random_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success", "random_numbers": [[1, 2, 3, 4, 5, 6]]})
    )
    client.generate_random_numbers(game="Lotto", lines=5)
    params = route.calls.last.request.url.params
    assert params["game"] == "Lotto"
    assert params["lines"] == "5"


@respx.mock
def test_generate_random_numbers_lines_optional(client):
    route = respx.get(f"{BASE}/api/generate_random_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.generate_random_numbers(game="Lotto")
    assert "lines" not in route.calls.last.request.url.params


def test_generate_random_numbers_requires_game(client):
    with pytest.raises(ValueError):
        client.generate_random_numbers(game="")


@respx.mock
def test_text_to_lucky_is_post_with_key_and_game_in_query_text_in_body(client):
    # This endpoint takes api_key and game in the query string; only `text`
    # goes in the JSON body.
    route = respx.post(f"{BASE}/api/text_to_lucky_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success", "lucky_numbers": [1, 2, 3, 4, 5, 6]})
    )
    client.text_to_lucky_numbers(game="Lotto", text="hello world")

    req = route.calls.last.request
    assert req.method == "POST"
    assert req.url.params["game"] == "Lotto"
    assert req.url.params["api_key"] == API_KEY
    body = json.loads(req.content)
    assert body["text"] == "hello world"
    assert "api_key" not in body


def test_text_to_lucky_requires_game_and_text(client):
    with pytest.raises(ValueError):
        client.text_to_lucky_numbers(game="Lotto", text="")
    with pytest.raises(ValueError):
        client.text_to_lucky_numbers(game="", text="hi")


@respx.mock
def test_hot_cold_sends_product(client):
    route = respx.get(f"{BASE}/api/get_hot_cold_numbers_stats").mock(
        return_value=httpx.Response(200, json={"status": "success", "hot": [], "cold": []})
    )
    client.get_hot_cold_numbers(product="Powerball")
    assert route.calls.last.request.url.params["product"] == "Powerball"


def test_hot_cold_requires_product(client):
    with pytest.raises(ValueError):
        client.get_hot_cold_numbers(product="")


@respx.mock
def test_number_frequencies_sends_product(client):
    route = respx.get(f"{BASE}/api/get_number_frequencies").mock(
        return_value=httpx.Response(200, json={"status": "success", "statistics": []})
    )
    client.get_number_frequencies(product="Lotto")
    assert route.calls.last.request.url.params["product"] == "Lotto"


@respx.mock
def test_number_pairs_sends_product(client):
    route = respx.get(f"{BASE}/api/get_number_pairs").mock(
        return_value=httpx.Response(200, json={"status": "success", "pairs": []})
    )
    client.get_number_pairs(product="Lotto")
    assert route.calls.last.request.url.params["product"] == "Lotto"
