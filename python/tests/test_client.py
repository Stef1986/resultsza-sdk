"""Client tests. The HTTP layer is always mocked (respx), so the suite needs no
API key and never calls the production API."""
import httpx
import pytest
import respx

from resultsza import ResultsZA
from resultsza.exceptions import BadRequestError

BASE = "https://resultsza.co.za"


def make_client(**kwargs):
    return ResultsZA(api_key="test-key-123", **kwargs)


# --- construction / auth / redaction ------------------------------------


def test_requires_api_key():
    with pytest.raises(ValueError):
        ResultsZA(api_key="")


def test_api_key_absent_from_repr():
    client = ResultsZA(api_key="super-secret-key")
    assert "super-secret-key" not in repr(client)


@respx.mock
def test_get_sends_api_key_as_query_param():
    route = respx.get(f"{BASE}/api/get_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success", "results": []})
    )
    make_client().get_lotto_results(date="2026-06-03")

    request = route.calls.last.request
    assert request.url.params["api_key"] == "test-key-123"
    assert request.url.params["date"] == "2026-06-03"


@respx.mock
def test_returns_parsed_json():
    payload = {"status": "success", "results": [{"winning_numbers": [1, 2, 3, 4, 5, 6]}]}
    respx.get(f"{BASE}/api/get_lotto_results").mock(
        return_value=httpx.Response(200, json=payload)
    )
    assert make_client().get_lotto_results() == payload


@respx.mock
def test_date_omitted_when_not_given():
    route = respx.get(f"{BASE}/api/get_lotto_results").mock(
        return_value=httpx.Response(200, json={"status": "success"})
    )
    make_client().get_lotto_results()
    assert "date" not in route.calls.last.request.url.params


def test_base_url_is_configurable():
    client = make_client(base_url="https://staging.example.test")
    assert client.base_url == "https://staging.example.test"


@respx.mock
def test_api_key_redacted_in_raised_error():
    respx.get(f"{BASE}/api/get_lotto_results").mock(
        return_value=httpx.Response(400, json={"status": "error", "message": "bad date"})
    )
    with pytest.raises(BadRequestError) as exc:
        make_client().get_lotto_results(date="nonsense")
    assert "test-key-123" not in str(exc.value)
