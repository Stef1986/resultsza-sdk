"""Typed exceptions so integrators can `except` predictably instead of parsing
raw response dicts. No exception message ever contains the API key.

Hierarchy::

    ResultsZAError
    ├── APIError
    │   ├── BadRequestError
    │   │   └── ValidationError        (also a ValueError; raised client-side)
    │   ├── AuthError
    │   │   ├── QuotaExceededError
    │   │   └── SubscriptionError
    │   │       ├── SubscriptionExpiredError
    │   │       └── SubscriptionPendingError
    │   └── RateLimitError
    └── InvalidSignatureError
"""


class ResultsZAError(Exception):
    """Base class for every error raised by this SDK."""


class APIError(ResultsZAError):
    """The API returned an error response.

    ``status_code`` is the HTTP status (may be None for transport errors and
    client-side validation). ``response`` is the parsed JSON body when one was
    available.
    """

    def __init__(self, message, status_code=None, response=None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class BadRequestError(APIError):
    """Invalid parameters (e.g. bad date, out-of-range span). Usually HTTP 400."""


class ValidationError(BadRequestError, ValueError):
    """Invalid parameters caught client-side, before any HTTP request is made.

    Subclasses both :class:`BadRequestError` (it is the same kind of problem
    the server would answer with HTTP 400) and :class:`ValueError` (so code
    written for 0.1.x that catches ``ValueError`` keeps working).
    ``status_code`` is None because no request was sent.
    """


class AuthError(APIError):
    """The API refused the key (HTTP 401): missing, invalid, deactivated, or
    an account problem. The more specific subclasses below say which, and
    anything not recognised stays a plain ``AuthError``."""


class QuotaExceededError(AuthError):
    """The key is valid but has no calls left: monthly allowance used up,
    tokens exhausted, or the free daily quota reached. Buy a top-up or
    upgrade, or wait for the allowance to reset."""


class RateLimitError(APIError):
    """Rate limit hit (HTTP 429). The Unlimited tier allows 60 req/min;
    exceeding it triggers a 5-minute cooldown. Back off, do not retry
    immediately.

    Extra attributes (None when the server did not send them):

    - ``retry_after``: seconds to wait before retrying.
    - ``cooldown``: True when the key is in the 5-minute cooldown.
    - ``cooldown_remaining``: seconds of cooldown left.
    - ``limit`` / ``remaining`` / ``reset``: the ``X-RateLimit-Limit``,
      ``X-RateLimit-Remaining`` and ``X-RateLimit-Reset`` response headers
      (``reset`` is a Unix timestamp).
    """

    def __init__(self, message, status_code=None, response=None, headers=None):
        super().__init__(message, status_code, response)
        body = response if isinstance(response, dict) else {}
        hdrs = {str(k).lower(): v for k, v in (headers or {}).items()}

        self.retry_after = _to_int(body.get("retry_after"))
        if self.retry_after is None:
            self.retry_after = _to_int(hdrs.get("retry-after"))
        self.cooldown = bool(body.get("cooldown")) or "x-ratelimit-cooldown" in hdrs
        self.cooldown_remaining = _to_int(body.get("cooldown_remaining"))
        if self.cooldown_remaining is None:
            self.cooldown_remaining = _to_int(hdrs.get("x-ratelimit-cooldown"))
        self.limit = _to_int(hdrs.get("x-ratelimit-limit"))
        self.remaining = _to_int(hdrs.get("x-ratelimit-remaining"))
        self.reset = _to_int(hdrs.get("x-ratelimit-reset"))


class SubscriptionError(AuthError):
    """The subscription is not in an ``active`` state. A subclass of
    :class:`AuthError`, because the API answers these with HTTP 401."""


class SubscriptionExpiredError(SubscriptionError):
    """Subscription (or the key itself) has expired; the key is deactivated
    until renewed."""


class SubscriptionPendingError(SubscriptionError):
    """Subscription payment is pending; the key is not yet active.

    Reserved: the data endpoints currently report an unpaid subscription as
    "Subscription is not active", which raises the base
    :class:`SubscriptionError`. :meth:`ResultsZA.check_balance` reports a
    pending subscription in its response body (``subscription_status``
    ``"pending"``) instead of raising."""


class InvalidSignatureError(ResultsZAError):
    """A webhook payload's signature did not match the expected HMAC."""


def _to_int(value):
    """Whole numbers (int, integral float, or digit string) as int, else None."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, float):
        return int(value) if value.is_integer() else None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None
