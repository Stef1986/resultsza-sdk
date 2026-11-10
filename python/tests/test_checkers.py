"""SA-only checkers: POST with game+date in the query, played_numbers + api_key
in the body, and client-side line-limit guards (10 / 500)."""
import json

import httpx
import pytest
import respx

from resultsza.exceptions import BadRequestError, ValidationError
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


@respx.mock
def test_bulk_check_wraps_a_flat_single_line(client):
    # The bulk endpoint requires a list of lines; a flat line returns HTTP
    # 400, so the client wraps it into [line] before sending.
    route = respx.post(f"{BASE}/api/bulk_check_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.bulk_check_numbers(game="Lotto", date="2026-06-03", played_numbers=[1, 2, 3, 4, 5, 6])
    body = json.loads(route.calls.last.request.content)
    assert body["played_numbers"] == [[1, 2, 3, 4, 5, 6]]


@respx.mock
def test_bulk_check_accepts_tuples(client):
    route = respx.post(f"{BASE}/api/bulk_check_numbers").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    client.bulk_check_numbers(
        game="Lotto", date="2026-06-03", played_numbers=[(1, 2, 3, 4, 5, 6), (7, 8, 9, 10, 11, 12)]
    )
    body = json.loads(route.calls.last.request.content)
    assert body["played_numbers"] == [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]


@respx.mock
def test_checkers_reject_a_mix_of_numbers_and_lines(client):
    route = respx.post(url__regex=rf"{BASE}/api/.*").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    mixed = [[1, 2, 3, 4, 5, 6], 7]
    with pytest.raises(ValidationError):
        client.check_played_numbers(game="Lotto", date="2026-06-03", played_numbers=mixed)
    with pytest.raises(ValidationError):
        client.bulk_check_numbers(game="Lotto", date="2026-06-03", played_numbers=mixed)
    assert not route.called


@respx.mock
@pytest.mark.parametrize("bad", ["2026-6-3", "03/06/2026", "2026-02-30", "20260603"])
def test_checkers_reject_bad_dates_without_calling(client, bad):
    route = respx.post(url__regex=rf"{BASE}/api/.*").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    with pytest.raises(ValidationError):
        client.check_played_numbers(game="Lotto", date=bad, played_numbers=[1, 2, 3, 4, 5, 6])
    with pytest.raises(ValidationError):
        client.bulk_check_numbers(game="Lotto", date=bad, played_numbers=[[1, 2, 3, 4, 5, 6]])
    assert not route.called


def test_validation_error_is_both_bad_request_and_value_error(client):
    with pytest.raises(ValidationError) as exc:
        client.check_played_numbers(game="", date="2026-06-03", played_numbers=[1, 2, 3, 4, 5, 6])
    assert isinstance(exc.value, BadRequestError)
    assert isinstance(exc.value, ValueError)
    assert exc.value.status_code is None
