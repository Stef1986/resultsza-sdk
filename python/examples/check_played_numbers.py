"""Check played lines against a South African draw.

    RESULTSZA_API_KEY=your_key python check_played_numbers.py
"""
import os

from resultsza import ResultsZA
from resultsza.exceptions import (
    APIError,
    AuthError,
    QuotaExceededError,
    SubscriptionError,
    ValidationError,
)

client = ResultsZA(api_key=os.environ["RESULTSZA_API_KEY"])

# Placeholder lines - replace with your own. Up to 10 lines per request here
# (1 call); use client.bulk_check_numbers(...) for up to 500 lines.
lines = [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
]

try:
    result = client.check_played_numbers(
        game="Lotto", date="2026-07-08", played_numbers=lines
    )
    print(result)
except ValidationError as exc:
    # Caught client-side (bad date, too many lines, ...): no request was sent.
    print(f"Invalid input: {exc}")
except QuotaExceededError as exc:
    print(f"Out of calls: {exc}")
except SubscriptionError as exc:
    print(f"Subscription not active: {exc}")
except AuthError as exc:
    print(f"API key problem: {exc}")
except APIError as exc:
    print(f"API error (HTTP {exc.status_code}): {exc}")
