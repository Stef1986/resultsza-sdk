"""Balance endpoint: free, no /api/ prefix, key in the body (not the URL)."""
import json

import httpx
import respx

from tests.conftest import API_KEY, BASE


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
