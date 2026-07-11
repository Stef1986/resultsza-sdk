"""A minimal, correct ResultsZA webhook receiver using Flask.

    pip install flask
    RESULTSZA_WEBHOOK_SECRET=your_secret python webhook_receiver_flask.py

The secret is the value shown in your portal Push Settings. It is read from the
environment - never hardcode it. Register your public HTTPS URL and send a test
delivery from Push Settings once this is running behind HTTPS.

The four things receivers get wrong, handled below:
  1. Verify against the RAW request bytes, not re-serialized JSON.
  2. Return 2xx within 10 seconds; do slow work afterwards.
  3. Deduplicate - delivery is at-least-once and unordered.
  4. Handle result.test so portal test sends don't hit your live pipeline.
"""
import os

from flask import Flask, request

from resultsza.exceptions import InvalidSignatureError
from resultsza.webhook import SIGNATURE_HEADER, verify_and_parse

app = Flask(__name__)
SECRET = os.environ["RESULTSZA_WEBHOOK_SECRET"]

# Swap this in-memory set for a durable store (Redis, a DB, etc.) in production.
_seen_keys = set()


@app.post("/webhooks/resultsza")
def receive():
    raw = request.get_data()  # RAW bytes - do NOT use request.json here
    signature = request.headers.get(SIGNATURE_HEADER, "")

    try:
        event = verify_and_parse(raw, signature, SECRET, headers=dict(request.headers))
    except InvalidSignatureError:
        return "", 401

    # Portal test sends - acknowledge but don't process.
    if event.is_test:
        return "", 204

    # Deduplicate at-least-once deliveries.
    key = event.dedupe_key()
    if key in _seen_keys:
        return "", 200
    _seen_keys.add(key)

    # Return quickly, THEN do the slow work (queue a job, write to a DB, etc.).
    # enqueue_processing(event.game, event.data)

    return "", 200


if __name__ == "__main__":
    # Behind a real HTTPS terminator in production - plain HTTP is rejected by
    # ResultsZA. This dev server is for local testing only.
    app.run(port=8000)
