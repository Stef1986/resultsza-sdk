"""Helpers for *receiving* ResultsZA webhooks: verify the signature and parse
the event envelope. There is no webhook-management API - endpoints and secrets
are configured in the portal's Push Settings - so this module is receive-side
only.

Verification is done over the raw request bytes with HMAC-SHA256 and a
constant-time compare. Always pass the exact bytes you received: hashing a
re-serialized copy of the JSON will not match.
"""
from __future__ import annotations

import hashlib
import hmac
import json

from .exceptions import InvalidSignatureError

# Headers ResultsZA sends with every delivery.
SIGNATURE_HEADER = "X-ResultsZA-Signature"
EVENT_HEADER = "X-ResultsZA-Event"
GAME_HEADER = "X-ResultsZA-Game"


def _as_bytes(raw_body):
    if isinstance(raw_body, str):
        return raw_body.encode("utf-8")
    return raw_body


def compute_signature(raw_body, secret):
    """Return the ``sha256=<hex>`` signature for ``raw_body`` under ``secret``."""
    digest = hmac.new(_as_bytes(secret), _as_bytes(raw_body), hashlib.sha256).hexdigest()
    return "sha256=" + digest


def verify_webhook_signature(raw_body, signature_header, secret):
    """Return True iff ``signature_header`` matches the HMAC of ``raw_body``.

    ``raw_body`` must be the exact bytes received (str is accepted and encoded
    as UTF-8). ``signature_header`` is the ``X-ResultsZA-Signature`` value,
    including its ``sha256=`` prefix. The comparison is constant-time.
    """
    if not signature_header:
        return False
    expected = compute_signature(raw_body, secret)
    return hmac.compare_digest(expected, signature_header)


class WebhookEvent:
    """A parsed webhook envelope.

    Attributes: ``event``, ``game``, ``country``, ``dispatched_at``, ``data``
    (the game-specific body), plus ``payload`` (the full dict) and ``headers``.
    """

    def __init__(self, payload, headers=None):
        self.payload = payload
        self.headers = headers or {}
        self.event = payload.get("event")
        self.game = payload.get("game")
        self.country = payload.get("country")
        self.dispatched_at = payload.get("dispatched_at")
        self.data = payload.get("data") or {}

    @property
    def is_test(self):
        """True for portal test sends (``result.test``) - handle or ignore
        these so test traffic does not enter your live pipeline."""
        return self.event == "result.test"

    def dedupe_key(self):
        """A best-effort key for deduplicating at-least-once deliveries.

        Combines the game with the most specific draw identifier present
        (``draw_number`` / ``draw_id``, else ``draw_date`` + ``draw_time``).
        Confirm it fits the games you subscribe to before relying on it.
        """
        parts = [self.game or ""]
        data = self.data
        if data.get("draw_number") is not None:
            parts.append(str(data["draw_number"]))
        elif data.get("draw_id") is not None:
            parts.append(str(data["draw_id"]))
        else:
            for key in ("draw_date", "date", "draw_time"):
                if data.get(key) is not None:
                    parts.append(str(data[key]))
        return ":".join(parts)

    def __repr__(self):
        return f"WebhookEvent(event={self.event!r}, game={self.game!r})"


def parse_event(raw_body, headers=None):
    """Parse a webhook payload into a :class:`WebhookEvent`. Does not verify
    the signature - call :func:`verify_webhook_signature` (or
    :func:`verify_and_parse`) for that."""
    payload = json.loads(_as_bytes(raw_body))
    return WebhookEvent(payload, headers=headers)


def verify_and_parse(raw_body, signature_header, secret, headers=None):
    """Verify the signature and return the parsed :class:`WebhookEvent`.

    Raises :class:`~resultsza.exceptions.InvalidSignatureError` if the
    signature does not match - do this before trusting any payload contents.
    """
    if not verify_webhook_signature(raw_body, signature_header, secret):
        raise InvalidSignatureError("Webhook signature verification failed.")
    return parse_event(raw_body, headers=headers)
