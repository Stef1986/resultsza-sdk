"""Thin synchronous client for the ResultsZA REST API.

Every method just builds the request (correct verb, correct param placement)
and returns the parsed JSON. Responses are intentionally *not* typed into
models: some endpoints return different shapes per game, so the raw parsed
JSON is handed back for the caller to inspect.

Auth: the API key travels as a ``?api_key=`` query parameter on GET, and - for
POST endpoints - in the JSON body, to keep it out of URLs (and therefore out of
server/proxy logs). Any key that would appear in a log or exception is redacted.
"""
from __future__ import annotations

from datetime import date as _date

import httpx

from .exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    RateLimitError,
    ResultsZAError,
    SubscriptionExpiredError,
    SubscriptionPendingError,
)

DEFAULT_BASE_URL = "https://resultsza.co.za"


class ResultsZA:
    """Client for the ResultsZA API.

    Args:
        api_key: your ResultsZA API key (https://resultsza.co.za/generate_api_key).
        base_url: override the API host (useful for testing).
        timeout: per-request timeout in seconds.
    """

    def __init__(self, api_key, base_url=DEFAULT_BASE_URL, timeout=30.0):
        if not api_key:
            raise ValueError(
                "api_key is required. Get one at "
                "https://resultsza.co.za/generate_api_key"
            )
        self._api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._http = httpx.Client(timeout=timeout)

    def __repr__(self):
        # Never expose the key.
        return f"ResultsZA(base_url={self.base_url!r})"

    # --- context manager / lifecycle ------------------------------------

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    # --- request plumbing -----------------------------------------------

    def _redact(self, text):
        """Scrub the API key out of any string before it is logged/raised."""
        if self._api_key and text and self._api_key in text:
            return text.replace(self._api_key, "***")
        return text

    def _get(self, path, params=None):
        return self._request("GET", path, params=params)

    def _post(self, path, params=None, json_body=None, api_key_in_body=False,
              raise_on_error_body=True):
        return self._request(
            "POST",
            path,
            params=params,
            json_body=json_body,
            api_key_in_body=api_key_in_body,
            raise_on_error_body=raise_on_error_body,
        )

    def _request(self, method, path, params=None, json_body=None, api_key_in_body=False,
                 raise_on_error_body=True):
        # Drop params the caller didn't set so empty values are not sent.
        clean = {k: v for k, v in (params or {}).items() if v is not None}

        if api_key_in_body:
            body = dict(json_body) if json_body is not None else {}
            body.setdefault("api_key", self._api_key)
            json_body = body
        else:
            clean["api_key"] = self._api_key

        url = f"{self.base_url}{path}"
        try:
            resp = self._http.request(method, url, params=clean, json=json_body)
        except httpx.HTTPError as exc:
            raise ResultsZAError(self._redact(str(exc))) from None

        return self._handle(resp, raise_on_error_body)

    def _handle(self, resp, raise_on_error_body=True):
        try:
            data = resp.json()
        except ValueError:
            data = None

        is_error_body = (
            raise_on_error_body
            and isinstance(data, dict)
            and data.get("status") == "error"
        )
        if resp.status_code >= 400 or is_error_body:
            self._raise(resp, data)
        return data

    def _raise(self, resp, data):
        status = resp.status_code
        message = None
        subscription = None
        if isinstance(data, dict):
            message = data.get("message")
            subscription = data.get("subscription_status")
        message = self._redact(message or f"HTTP {status}")

        if subscription == "expired":
            raise SubscriptionExpiredError(message, status, data)
        if subscription == "pending":
            raise SubscriptionPendingError(message, status, data)
        if status in (401, 403):
            raise AuthError(message, status, data)
        if status == 429:
            raise RateLimitError(message, status, data)
        if status == 400:
            raise BadRequestError(message, status, data)
        raise APIError(message, status, data)

    # ================================================================
    # Endpoints
    # ================================================================

    # --- South Africa (date optional; omit for the latest draw) ---------

    def get_daily_lotto_results(self, date=None):
        """Daily Lotto results."""
        return self._get("/api/get_daily_lotto_results", {"date": date})

    def get_lotto_results(self, date=None):
        """Lotto results. ``date`` (YYYY-MM-DD) optional; omit for latest."""
        return self._get("/api/get_lotto_results", {"date": date})

    def get_lotto_plus_1_results(self, date=None):
        """Lotto Plus 1 results."""
        return self._get("/api/get_lotto_plus_1_results", {"date": date})

    def get_lotto_5_max_results(self, date=None):
        """Lotto 5 Max results (replaced Lotto Plus 2 from 2026-06-01)."""
        return self._get("/api/get_lotto_5_max_results", {"date": date})

    def get_sa_powerball_results(self, date=None):
        """SA Powerball results."""
        return self._get("/api/get_sa_powerball_results", {"date": date})

    def get_powerball_xtra_results(self, date=None):
        """Powerball Xtra results (renamed from Powerball Plus, 2026-06-01)."""
        return self._get("/api/get_powerball_xtra_results", {"date": date})

    # --- Africa ---------------------------------------------------------

    def get_kenya_lotto_results(self, date=None, draw_type=None):
        """Kenya Lotto results.

        ``draw_type`` maps to the ``type`` query param: ``"daily"`` or
        ``"jackpot"``. ``date`` returns all draws for that day, newest first.
        """
        return self._get(
            "/api/get_kenya_lotto_results", {"date": date, "type": draw_type}
        )

    def get_nigeria_lotto_results(self, game=None, date=None):
        """Nigeria (Premier Lotto) results. Omit ``game`` for all games on the date."""
        return self._get(
            "/api/get_nigeria_lotto_results", {"game": game, "date": date}
        )

    def get_ghana_lotto_results(self, game=None, date=None):
        """Ghana Lotto results. Omit ``game`` for all games on the date."""
        return self._get(
            "/api/get_ghana_lotto_results", {"game": game, "date": date}
        )

    # --- United Kingdom -------------------------------------------------

    def get_uk49s_results(self, game=None, date=None):
        """UK 49's results. ``game`` is required: one of ``UK49s Brunchtime``,
        ``UK49s Lunchtime``, ``UK49s Drivetime``, ``UK49s Teatime``."""
        if not game:
            raise ValueError(
                "game is required for UK 49's: one of 'UK49s Brunchtime', "
                "'UK49s Lunchtime', 'UK49s Drivetime', 'UK49s Teatime'."
            )
        return self._get("/api/get_uk49s_results", {"game": game, "date": date})

    # --- Europe ---------------------------------------------------------

    def get_euromillions_results(self, date=None):
        """EuroMillions results."""
        return self._get("/api/get_euromillions_results", {"date": date})

    def get_irish_lotto_results(self, date=None):
        """Irish Lotto results."""
        return self._get("/api/get_irish_lotto_results", {"date": date})

    # --- United States --------------------------------------------------

    def get_us_powerball_results(self, date=None):
        """US Powerball results."""
        return self._get("/api/get_us_powerball_results", {"date": date})

    def get_megamillions_results(self, date=None):
        """US Mega Millions results."""
        return self._get("/api/get_megamillions_results", {"date": date})

    # --- Horse racing ---------------------------------------------------

    def get_horse_racing_meetings(self, from_date=None, to_date=None):
        """List race meetings. ``from_date`` defaults to 7 days ago and
        ``to_date`` to today (server-side). The span may not exceed 7 days;
        this is validated client-side to avoid wasting an API call on a
        request the server would reject with HTTP 400.
        """
        if from_date and to_date:
            try:
                span = (_date.fromisoformat(to_date) - _date.fromisoformat(from_date)).days
            except ValueError:
                raise ValueError(
                    "from_date and to_date must be 'YYYY-MM-DD' strings."
                ) from None
            if span < 0:
                raise ValueError("to_date must not be before from_date.")
            if span > 7:
                raise ValueError(
                    "Date range too wide: a maximum of 7 days can be queried per call."
                )
        return self._get(
            "/api/get_horse_racing_meetings",
            {"from_date": from_date, "to_date": to_date},
        )

    def get_horse_racing_results(self, date=None, venue=None):
        """Full race card for one venue on one day. ``date`` and ``venue``
        are both required (e.g. venue ``Greyville``, ``Kenilworth``)."""
        if not date or not venue:
            raise ValueError("date and venue are both required for a race card.")
        return self._get(
            "/api/get_horse_racing_results", {"date": date, "venue": venue}
        )

    def get_horse_racing_race(self, date=None, venue=None, race_no=None):
        """Runner table for a single race. ``date``, ``venue`` and ``race_no``
        (1-based) are all required."""
        if not date or not venue or race_no is None:
            raise ValueError(
                "date, venue and race_no are all required for a runner table."
            )
        return self._get(
            "/api/get_horse_racing_race",
            {"date": date, "venue": venue, "race_no": race_no},
        )

    # --- Number generators ----------------------------------------------

    def generate_random_numbers(self, game=None, lines=None):
        """Generate random lines for ``game``. ``lines`` defaults to 1 server-side
        and one request costs a single API call regardless of line count.

        The response shape depends on the game (plain arrays, or objects with
        ``powerball`` / ``lucky_stars``), so the parsed JSON is returned as-is.
        """
        if not game:
            raise ValueError("game is required.")
        return self._get(
            "/api/generate_random_numbers", {"game": game, "lines": lines}
        )

    def text_to_lucky_numbers(self, game=None, text=None):
        """Deterministically turn ``text`` into lucky numbers for ``game``
        (same text always yields the same numbers). POST: ``api_key`` and
        ``game`` travel as query params, ``text`` in the JSON body."""
        if not game:
            raise ValueError("game is required.")
        if not text:
            raise ValueError("text is required.")
        return self._post(
            "/api/text_to_lucky_numbers",
            params={"game": game},
            json_body={"text": text},
        )

    # --- Analysis -------------------------------------------------------

    def get_hot_cold_numbers(self, product=None):
        """Top 10 hot and cold numbers for ``product``."""
        if not product:
            raise ValueError("product is required.")
        return self._get("/api/get_hot_cold_numbers_stats", {"product": product})

    def get_number_frequencies(self, product=None):
        """Per-number draw frequencies for ``product``."""
        if not product:
            raise ValueError("product is required.")
        return self._get("/api/get_number_frequencies", {"product": product})

    def get_number_pairs(self, product=None):
        """Top 10 most-drawn number pairs for ``product``."""
        if not product:
            raise ValueError("product is required.")
        return self._get("/api/get_number_pairs", {"product": product})

    # --- Checkers (SA games only) ---------------------------------------

    @staticmethod
    def _line_count(played_numbers):
        # A list of lists is N lines; a flat list of ints is a single line.
        if played_numbers and all(
            isinstance(line, (list, tuple)) for line in played_numbers
        ):
            return len(played_numbers)
        return 1

    def _check(self, path, game, date, played_numbers, max_lines):
        if not game:
            raise ValueError("game is required (SA games only).")
        if not date:
            raise ValueError("date is required (YYYY-MM-DD).")
        if not played_numbers:
            raise ValueError("played_numbers is required.")
        count = self._line_count(played_numbers)
        if count > max_lines:
            raise ValueError(
                f"Too many lines: {count} supplied, but this endpoint accepts "
                f"at most {max_lines} per request."
            )
        # api_key, game and date are query params; played_numbers is the body.
        return self._post(
            path,
            params={"game": game, "date": date},
            json_body={"played_numbers": played_numbers},
        )

    def check_played_numbers(self, game=None, date=None, played_numbers=None):
        """Check played lines against a SA draw. Up to 10 lines, costs 1 call.
        ``played_numbers`` is a single line ``[1, 6, 29, 11, 15, 17]`` or a list
        of lines. For Powerball games the last number is the Powerball."""
        return self._check(
            "/api/check_played_numbers", game, date, played_numbers, max_lines=10
        )

    def bulk_check_numbers(self, game=None, date=None, played_numbers=None):
        """Bulk-check up to 500 lines against a SA draw. Costs 5 calls per 50
        lines (or part thereof)."""
        return self._check(
            "/api/bulk_check_numbers", game, date, played_numbers, max_lines=500
        )

    # --- Account --------------------------------------------------------

    def check_balance(self):
        """Remaining calls and subscription status. Free - consumes no API
        calls. Note the path has no ``/api/`` prefix; the key rides in the body
        (POST) to stay out of URLs. Returns the status for inspection rather
        than raising when the subscription is pending/expired."""
        return self._post(
            "/check_api_key_balance", api_key_in_body=True, raise_on_error_body=False
        )
