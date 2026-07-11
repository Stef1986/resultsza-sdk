"""Official Python client and webhook-receiver toolkit for the ResultsZA API.

Requires your own API key from https://resultsza.co.za/generate_api_key
"""
from .client import ResultsZA
from .exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    InvalidSignatureError,
    RateLimitError,
    ResultsZAError,
    SubscriptionError,
    SubscriptionExpiredError,
    SubscriptionPendingError,
)
from .webhook import (
    WebhookEvent,
    parse_event,
    verify_and_parse,
    verify_webhook_signature,
)

__version__ = "0.1.1"

__all__ = [
    "ResultsZA",
    "ResultsZAError",
    "APIError",
    "AuthError",
    "BadRequestError",
    "RateLimitError",
    "SubscriptionError",
    "SubscriptionExpiredError",
    "SubscriptionPendingError",
    "InvalidSignatureError",
    "verify_webhook_signature",
    "verify_and_parse",
    "parse_event",
    "WebhookEvent",
]
