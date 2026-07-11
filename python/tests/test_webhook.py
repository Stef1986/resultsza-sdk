"""Webhook receiver tests. Payloads are signed with an ephemeral secret created
inside the test - no real webhook secret is used or shipped."""
import hashlib
import hmac
import json

import pytest

from resultsza.exceptions import InvalidSignatureError
from resultsza.webhook import parse_event, verify_and_parse, verify_webhook_signature

SECRET = "ephemeral-test-secret"


def sign(raw_body, secret=SECRET):
    """Independently compute the header the way the server would."""
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return "sha256=" + digest


# --- signature verification -----------------------------------------------


def test_accepts_valid_signature():
    body = b'{"event":"result.published","game":"lotto"}'
    assert verify_webhook_signature(body, sign(body), SECRET) is True


def test_rejects_tampered_body():
    body = b'{"event":"result.published","game":"lotto"}'
    sig = sign(body)
    tampered = b'{"event":"result.published","game":"powerball"}'
    assert verify_webhook_signature(tampered, sig, SECRET) is False


def test_rejects_wrong_secret():
    body = b'{"n":1}'
    assert verify_webhook_signature(body, sign(body, "different-secret"), SECRET) is False


def test_requires_sha256_prefix():
    body = b'{"n":1}'
    bare_hex = hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, bare_hex, SECRET) is False


def test_missing_header_returns_false():
    assert verify_webhook_signature(b"{}", None, SECRET) is False
    assert verify_webhook_signature(b"{}", "", SECRET) is False


def test_accepts_str_body():
    body = '{"n":1}'
    assert verify_webhook_signature(body, sign(body.encode()), SECRET) is True


# --- envelope parsing -----------------------------------------------------


def test_parse_extracts_envelope():
    payload = {
        "event": "result.published",
        "game": "lotto",
        "country": "ZA",
        "dispatched_at": "2026-06-25T21:05:00Z",
        "data": {"draw_number": 1234},
    }
    ev = parse_event(json.dumps(payload).encode())
    assert ev.event == "result.published"
    assert ev.game == "lotto"
    assert ev.country == "ZA"
    assert ev.dispatched_at == "2026-06-25T21:05:00Z"
    assert ev.data["draw_number"] == 1234
    assert ev.is_test is False


def test_parse_flags_test_event():
    ev = parse_event(json.dumps({"event": "result.test", "game": "lotto", "data": {}}).encode())
    assert ev.is_test is True


def test_parse_exposes_headers():
    ev = parse_event(
        json.dumps({"event": "result.published", "game": "lotto", "data": {}}).encode(),
        headers={"X-ResultsZA-Game": "lotto", "X-ResultsZA-Event": "result.published"},
    )
    assert ev.headers["X-ResultsZA-Game"] == "lotto"


def test_dedupe_key_sa_uses_draw_number():
    ev = parse_event(
        json.dumps({"event": "result.published", "game": "lotto", "data": {"draw_number": 2500}}).encode()
    )
    assert ev.dedupe_key() == "lotto:2500"


def test_dedupe_key_falls_back_to_date_and_time():
    ev = parse_event(
        json.dumps(
            {
                "event": "result.published",
                "game": "PREMIER PEOPLES",
                "data": {"draw_date": "2026-06-25", "draw_time": "14:00"},
            }
        ).encode()
    )
    assert ev.dedupe_key() == "PREMIER PEOPLES:2026-06-25:14:00"


# --- verify_and_parse -----------------------------------------------------


def test_verify_and_parse_returns_event_when_valid():
    body = json.dumps({"event": "result.published", "game": "lotto", "data": {}}).encode()
    ev = verify_and_parse(body, sign(body), SECRET)
    assert ev.game == "lotto"


def test_verify_and_parse_raises_on_bad_signature():
    body = json.dumps({"event": "result.published"}).encode()
    with pytest.raises(InvalidSignatureError):
        verify_and_parse(body, "sha256=deadbeef", SECRET)
