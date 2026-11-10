"""Error mapping: HTTP status and the JSON `status`/`subscription_status`
fields become typed exceptions, and the key is never leaked in a message."""
import httpx
import pytest
import respx

from resultsza.exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    QuotaExceededError,
    RateLimitError,
    SubscriptionError,
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
        client.get_lotto_results(date="2026-06-03")
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


# --- 401 message mapping ---------------------------------------------------
# The API answers every key problem with HTTP 401 and {status, message}; it
# never sends subscription_status on data endpoints, so the message decides.

AUTH_MESSAGES = [
    ("Subscription has expired. Please renew your subscription.", SubscriptionExpiredError),
    ("API key expired", SubscriptionExpiredError),
    ("Subscription is not active. Please renew your subscription.", SubscriptionError),
    (
        "You are out of API credits. Please acquire more tokens or upgrade your subscription.",
        QuotaExceededError,
    ),
    (
        "You have used all your API credits for this month. Purchase a call top-up to get "
        "through the rest of the month, or upgrade your subscription for a higher monthly limit.",
        QuotaExceededError,
    ),
    ("Monthly API limit would be exceeded. You have 3 calls remaining this month.", QuotaExceededError),
    ("Daily API request quota reached. Please purchase a subscription.", QuotaExceededError),
    ("Not enough API requests remaining", QuotaExceededError),
    ("Invalid API key", AuthError),
    ("API key is not active", AuthError),
    ("Internal Server Error", AuthError),
]


@respx.mock
@pytest.mark.parametrize("message,expected", AUTH_MESSAGES)
def test_401_message_maps_to_specific_error(client, message, expected):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(401, json={"status": "error", "message": message})
    )
    with pytest.raises(expected) as exc:
        client.get_lotto_results()
    assert type(exc.value) is expected
    assert exc.value.status_code == 401
    # Every 401 is still an AuthError, so 0.1.x `except AuthError` code works.
    assert isinstance(exc.value, AuthError)


def test_new_errors_keep_hierarchy_backward_compatible():
    assert issubclass(QuotaExceededError, AuthError)
    assert issubclass(SubscriptionError, AuthError)
    assert issubclass(SubscriptionExpiredError, SubscriptionError)
    assert issubclass(SubscriptionPendingError, SubscriptionError)
    assert issubclass(AuthError, APIError)


@respx.mock
def test_500_maps_to_api_error(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(500, json={"status": "error", "message": "Internal Server Error"})
    )
    with pytest.raises(APIError) as exc:
        client.get_lotto_results()
    assert type(exc.value) is APIError
    assert exc.value.status_code == 500


# --- 429 details -------------------------------------------------------------


@respx.mock
def test_rate_limit_exposes_retry_after_cooldown_and_headers(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(
            429,
            json={
                "error": "rate_limited",
                "message": "Rate limit exceeded. You are in a 5-minute cooldown period.",
                "retry_after": 300,
                "cooldown": True,
                "cooldown_remaining": 300,
            },
            headers={
                "X-RateLimit-Limit": "60",
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": "1767225600",
                "X-RateLimit-Cooldown": "300",
            },
        )
    )
    with pytest.raises(RateLimitError) as exc:
        client.get_lotto_results()
    err = exc.value
    assert err.status_code == 429
    assert err.retry_after == 300
    assert err.cooldown is True
    assert err.cooldown_remaining == 300
    assert err.limit == 60
    assert err.remaining == 0
    assert err.reset == 1767225600
    assert "cooldown" in str(err)


@respx.mock
def test_rate_limit_without_cooldown(client):
    respx.get(LOTTO).mock(
        return_value=httpx.Response(
            429,
            json={
                "error": "rate_limited",
                "message": "Too many requests. Unlimited plan is subject to rate limits.",
                "retry_after": 12,
                "cooldown": False,
                "cooldown_remaining": None,
            },
        )
    )
    with pytest.raises(RateLimitError) as exc:
        client.get_lotto_results()
    assert exc.value.retry_after == 12
    assert exc.value.cooldown is False
    assert exc.value.cooldown_remaining is None
    assert exc.value.limit is None


def test_rate_limit_error_accepts_plain_header_dict():
    err = RateLimitError("x", 429, {}, headers={"retry-after": "7", "X-RateLimit-Limit": "60"})
    assert err.retry_after == 7
    assert err.limit == 60
