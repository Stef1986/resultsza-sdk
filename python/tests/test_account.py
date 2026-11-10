"""Balance endpoint: free, no /api/ prefix, key in the body (not the URL)."""
import json

import httpx
import pytest
import respx

from resultsza.exceptions import AuthError
from tests.conftest import API_KEY, BASE

BALANCE = f"{BASE}/check_api_key_balance"


@respx.mock
def test_check_balance_unprefixed_path_key_in_body(client):
    route = respx.post(f"{BASE}/check_api_key_balance").mock(
        return_value=httpx.Response(
            200,
            json={"status": "success", "remaining": 6000, "subscription_status": "active"},
        )
    )
    data = client.check_balance()

    req = route.calls.last.request
    assert req.method == "POST"
    assert "api_key" not in req.url.params  # never in the URL
    assert json.loads(req.content)["api_key"] == API_KEY
    assert data["remaining"] == 6000


@respx.mock
def test_check_balance_returns_403_out_of_credits_body(client):
    # A capped plan that is out of credits gets HTTP 403 with the usage
    # fields; check_balance reports it instead of raising.
    body = {
        "status": "error",
        "billing_model": "subscription",
        "message": "You have used all your API credits for this month.",
        "tier": "starter",
        "monthly_limit": 6000,
        "used": 6000,
        "remaining": 0,
        "subscription_status": "active",
        "subscription_end": "2026-12-01",
        "days_until_expiry": 21,
        "usage_breakdown": [],
    }
    respx.post(BALANCE).mock(return_value=httpx.Response(403, json=body))
    assert client.check_balance() == body


@respx.mock
def test_check_balance_reports_no_subscription(client):
    respx.post(BALANCE).mock(
        return_value=httpx.Response(
            200,
            json={
                "status": "success",
                "billing_model": "subscription",
                "subscription_status": "none",
                "tier": None,
                "push_subscription": None,
            },
        )
    )
    data = client.check_balance()
    assert data["subscription_status"] == "none"
    assert data["push_subscription"] is None


@respx.mock
def test_check_balance_unknown_key_raises_auth_error(client):
    respx.post(BALANCE).mock(
        return_value=httpx.Response(404, json={"status": "error", "message": "API key not found."})
    )
    with pytest.raises(AuthError) as exc:
        client.check_balance()
    assert exc.value.status_code == 404
    assert "API key not found." in str(exc.value)
