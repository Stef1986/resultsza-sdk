"""Typed exceptions so integrators can `except` predictably instead of parsing
raw response dicts. No exception message ever contains the API key."""


class ResultsZAError(Exception):
    """Base class for every error raised by this SDK."""


class APIError(ResultsZAError):
    """The API returned an error response.

    ``status_code`` is the HTTP status (may be None for transport errors).
    ``response`` is the parsed JSON body when one was available.
    """

    def __init__(self, message, status_code=None, response=None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class BadRequestError(APIError):
    """Invalid parameters (e.g. bad date, out-of-range span). Usually HTTP 400."""


class AuthError(APIError):
    """The API key is missing, invalid, or deactivated."""


class RateLimitError(APIError):
    """Rate limit hit. The Unlimited tier allows 60 req/min; exceeding it
    triggers a 5-minute cooldown. Back off - do not retry immediately."""


class SubscriptionError(APIError):
    """The subscription is not in an ``active`` state."""


class SubscriptionExpiredError(SubscriptionError):
    """Subscription has expired; the key is deactivated until renewed."""


class SubscriptionPendingError(SubscriptionError):
    """Subscription payment is pending; the key is not yet active."""


class InvalidSignatureError(ResultsZAError):
    """A webhook payload's signature did not match the expected HMAC."""
