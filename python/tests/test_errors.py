"""Error mapping: HTTP status and the JSON `status`/`subscription_status`
fields become typed exceptions, and the key is never leaked in a message."""
import httpx
import pytest
import respx

from resultsza.exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    RateLimitError,
    SubscriptionExpiredError,
    SubscriptionPendingError,
)
from tests.conftest import BASE

LOTTO = f"{BASE}/api/get_lotto_results"


@respx.mock
def test_subscription_expired_maps_from_field(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(
            200, json={"status": "error", "subscription_status": "expired", "message": "gone"}
        )
    )
    with pytest.raises(SubscriptionExpiredError):
        client.get_lotto_results()


@respx.mock
def test_subscription_pending_maps_from_field(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(
            200, json={"status": "error", "subscription_status": "pending", "message": "wait"}
        )
    )
    with pytest.raises(SubscriptionPendingError):
        client.get_lotto_results()


@respx.mock
def test_401_maps_to_auth_error(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(401, json={"status": "error", "message": "invalid api key"})
    )
    with pytest.raises(AuthError):
        client.get_lotto_results()


@respx.mock
def test_429_maps_to_rate_limit(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(429, json={"status": "error", "message": "slow down"})
    )
    with pytest.raises(RateLimitError):
        client.get_lotto_results()


@respx.mock
def test_error_status_in_200_body_raises(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(200, json={"status": "error", "message": "no draw found"})
    )
    with pytest.raises(APIError) as exc:
        client.get_lotto_results()
    assert "no draw found" in str(exc.value)


@respx.mock
def test_exception_carries_status_and_response(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(400, json={"status": "error", "message": "bad date"})
    )
    with pytest.raises(BadRequestError) as exc:
        client.get_lotto_results(date="xx")
    assert exc.value.status_code == 400
    assert exc.value.response["message"] == "bad date"


@respx.mock
def test_message_redacts_key_if_echoed(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(
            400, json={"status": "error", "message": "bad key test-key-123"}
        )
    )
    with pytest.raises(BadRequestError) as exc:
        client.get_lotto_results()
    assert "test-key-123" not in str(exc.value)
    assert "***" in str(exc.value)


@respx.mock
def test_check_balance_reports_expired_without_raising(client):
    # check_balance is diagnostic - it returns the status for inspection
    # rather than raising, even when the subscription is not active.
    respx.post(f"{BASE}/check_api_key_balance").mock(
        return_value=httpx.Response(
            200, json={"status": "error", "subscription_status": "expired", "message": "gone"}
        )
    )
    data = client.check_balance()
    assert data["subscription_status"] == "expired"
