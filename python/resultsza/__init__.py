"""Official Python client and webhook-receiver toolkit for the ResultsZA API.

Requires your own API key: create a free account at https://resultsza.co.za/signup,
then generate the key in My Dashboard.
"""
from .client import ResultsZA
from .exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    InvalidSignatureError,
    QuotaExceededError,
    RateLimitError,
    ResultsZAError,
    SubscriptionError,
    SubscriptionExpiredError,
    SubscriptionPendingError,
    ValidationError,
)
from .webhook import (
    WebhookEvent,
    parse_event,
    verify_and_parse,
    verify_webhook_signature,
)

__version__ = "0.2.0"

__all__ = [
    "ResultsZA",
    "ResultsZAError",
    "APIError",
    "AuthError",
    "BadRequestError",
    "ValidationError",
    "QuotaExceededError",
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
