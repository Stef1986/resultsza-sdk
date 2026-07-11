"""Standalone webhook signature verification - framework-agnostic.

Use this inside whatever handler you already have. The two rules that matter:
pass the RAW request bytes, and read the secret from the environment.

    RESULTSZA_WEBHOOK_SECRET=your_secret python verify_webhook.py
"""
import hashlib
import hmac
import json
import os

from resultsza.webhook import verify_webhook_signature

SECRET = os.environ["RESULTSZA_WEBHOOK_SECRET"]

# --- In a real handler, `raw_body` and `signature` come from the request. ---
# Here we fabricate a signed sample so the example is self-contained. The
# numbers are placeholders, not real results.
raw_body = json.dumps(
    {
        "event": "result.published",
        "game": "lotto",
        "country": "ZA",
        "dispatched_at": "2026-06-25T21:05:00Z",
        "data": {"draw_number": 1234, "winning_numbers": [1, 2, 3, 4, 5, 6]},
    }
).encode()
signature = "sha256=" + hmac.new(SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
# ---------------------------------------------------------------------------

if verify_webhook_signature(raw_body, signature, SECRET):
    print("signature OK - safe to process")
else:
    print("signature INVALID - reject this request")
