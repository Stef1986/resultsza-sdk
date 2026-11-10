"""Thin synchronous client for the ResultsZA REST API.

Every method just builds the request (correct verb, correct param placement)
and returns the parsed JSON. Responses are intentionally *not* typed into
models: some endpoints return different shapes per game, so the raw parsed
JSON is handed back for the caller to inspect.

Auth: the API key travels as an ``api_key`` query parameter on every endpoint,
GET and POST alike, because that is where the API reads it. The one exception
is :meth:`ResultsZA.check_balance`, which sends the key in the JSON body. Any
key that would appear in a log or exception is redacted.

Client-side validation (dates, line counts, the meetings span, required
params) raises :class:`~resultsza.exceptions.ValidationError` before any HTTP
request, so bad input never costs a round trip.
"""
from __future__ import annotations

import re
from datetime import date as _date
from datetime import datetime as _datetime
from datetime import timedelta as _timedelta
from datetime import timezone as _timezone

import httpx

from .exceptions import (
    APIError,
    AuthError,
    BadRequestError,
    QuotaExceededError,
    RateLimitError,
    ResultsZAError,
    SubscriptionError,
    SubscriptionExpiredError,
    SubscriptionPendingError,
    ValidationError,
)

DEFAULT_BASE_URL = "https://resultsza.co.za"
SIGNUP_URL = "https://resultsza.co.za/signup"

# South African Standard Time is UTC+2 all year (no daylight saving), so a
# fixed offset matches the server's idea of "today" without needing tzdata.
_SAST = _timezone(_timedelta(hours=2))

_DATE_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")

# 401 messages that mean "valid key, no calls left". Matched case-insensitively
# as substrings of the API's message.
_QUOTA_MESSAGES = (
    "you are out of api credits",
    "you have used all your api credits for this month",
    "monthly api limit would be exceeded",
    "daily api request quota reached",
    "not enough api requests remaining",
    "you have used all your free backlink api calls",
)


def _sast_today():
    """Today's date in South Africa (the API's default for date ranges)."""
    return _datetime.now(_SAST).date()


def _parse_date(name, value):
    """Return ``value`` as a date, or raise ValidationError unless it is a
    strict ``YYYY-MM-DD`` string naming a real calendar day."""
    if not isinstance(value, str) or not _DATE_RE.fullmatch(value):
        raise ValidationError(
            f"{name} must be a 'YYYY-MM-DD' string, got {value!r}."
        )
    try:
        return _date(int(value[0:4]), int(value[5:7]), int(value[8:10]))
    except ValueError:
        raise ValidationError(f"{name} is not a real calendar date: {value!r}.") from None


def _check_date(name, value):
    """Validate an optional date param; ``None``/empty means "not given"."""
    if value is None or value == "":
        return
    _parse_date(name, value)


def _classify_auth(message):
    """Pick the AuthError subclass that fits a 401/403 message."""
    text = (message or "").strip().lower()
    if "subscription has expired" in text or text == "api key expired":
        return SubscriptionExpiredError
    if "subscription is pending" in text or "pending payment" in text:
        return SubscriptionPendingError
    if "subscription is not active" in text:
        return SubscriptionError
    if any(phrase in text for phrase in _QUOTA_MESSAGES):
        return QuotaExceededError
    return AuthError


class ResultsZA:
    """Client for the ResultsZA API.

    Args:
        api_key: your ResultsZA API key. Create a free account at
            https://resultsza.co.za/signup, then generate the key in My Dashboard.
        base_url: override the API host (useful for testing).
        timeout: per-request timeout in seconds.
    """

    def __init__(self, api_key, base_url=DEFAULT_BASE_URL, timeout=30.0):
        if not api_key:
            raise ValueError(
                "api_key is required. Create a free account at "
                f"{SIGNUP_URL}, then generate a key in My Dashboard."
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
              raise_on_error_body=True, report_statuses=()):
        return self._request(
            "POST",
            path,
            params=params,
            json_body=json_body,
            api_key_in_body=api_key_in_body,
            raise_on_error_body=raise_on_error_body,
            report_statuses=report_statuses,
        )

    def _request(self, method, path, params=None, json_body=None, api_key_in_body=False,
                 raise_on_error_body=True, report_statuses=()):
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

        return self._handle(resp, raise_on_error_body, report_statuses)

    def _handle(self, resp, raise_on_error_body=True, report_statuses=()):
        try:
            data = resp.json()
        except ValueError:
            data = None

        # Some statuses carry a report the caller asked for (check_balance's
        # 403 out-of-credits body), so hand the body back instead of raising.
        if resp.status_code in report_statuses and isinstance(data, dict):
            return data

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
        raw_message = message or ""
        message = self._redact(message or f"HTTP {status}")

        if subscription == "expired":
            raise SubscriptionExpiredError(message, status, data)
        if subscription == "pending":
            raise SubscriptionPendingError(message, status, data)
        if status in (401, 403):
            raise _classify_auth(raw_message)(message, status, data)
        if status == 429:
            raise RateLimitError(message, status, data, headers=resp.headers)
        if status == 400:
            raise BadRequestError(message, status, data)
        raise APIError(message, status, data)

    # ================================================================
    # Endpoints
    # ================================================================

    # --- South Africa (date optional; omit for the latest draw) ---------

    def _by_date(self, path, date):
        _check_date("date", date)
        return self._get(path, {"date": date})

    def get_daily_lotto_results(self, date=None):
        """Daily Lotto results."""
        return self._by_date("/api/get_daily_lotto_results", date)

    def get_lotto_results(self, date=None):
        """Lotto results. ``date`` (YYYY-MM-DD) optional; omit for latest."""
        return self._by_date("/api/get_lotto_results", date)

    def get_lotto_plus_1_results(self, date=None):
        """Lotto Plus 1 results."""
        return self._by_date("/api/get_lotto_plus_1_results", date)

    def get_lotto_5_max_results(self, date=None):
        """Lotto 5 Max results (replaced Lotto Plus 2 from 2026-06-01)."""
        return self._by_date("/api/get_lotto_5_max_results", date)

    def get_sa_powerball_results(self, date=None):
        """SA Powerball results."""
        return self._by_date("/api/get_sa_powerball_results", date)

    def get_powerball_xtra_results(self, date=None):
        """Powerball Xtra results (renamed from Powerball Plus, 2026-06-01)."""
        return self._by_date("/api/get_powerball_xtra_results", date)

    # --- Africa ---------------------------------------------------------

    def get_kenya_lotto_results(self, date=None, draw_type=None):
        """Kenya Lotto results.

        ``draw_type`` maps to the ``type`` query param: ``"daily"`` or
        ``"jackpot"``. ``date`` returns all draws for that day, newest first.
        """
        _check_date("date", date)
        return self._get(
            "/api/get_kenya_lotto_results", {"date": date, "type": draw_type}
        )

    def get_nigeria_lotto_results(self, game=None, date=None):
        """Nigeria (Premier Lotto) results. Omit ``game`` for all games on the date."""
        _check_date("date", date)
        return self._get(
            "/api/get_nigeria_lotto_results", {"game": game, "date": date}
        )

    def get_ghana_lotto_results(self, game=None, date=None):
        """Ghana Lotto results. Omit ``game`` for all games on the date."""
        _check_date("date", date)
        return self._get(
            "/api/get_ghana_lotto_results", {"game": game, "date": date}
        )

    # --- United Kingdom -------------------------------------------------

    def get_uk49s_results(self, game=None, date=None):
        """UK 49's results. ``game`` is required: one of ``UK49s Brunchtime``,
        ``UK49s Lunchtime``, ``UK49s Drivetime``, ``UK49s Teatime``."""
        if not game:
            raise ValidationError(
                "game is required for UK 49's: one of 'UK49s Brunchtime', "
                "'UK49s Lunchtime', 'UK49s Drivetime', 'UK49s Teatime'."
            )
        _check_date("date", date)
        return self._get("/api/get_uk49s_results", {"game": game, "date": date})

    # --- Europe ---------------------------------------------------------

    def get_euromillions_results(self, date=None):
        """EuroMillions results."""
        return self._by_date("/api/get_euromillions_results", date)

    def get_irish_lotto_results(self, date=None):
        """Irish Lotto results."""
        return self._by_date("/api/get_irish_lotto_results", date)

    # --- United States --------------------------------------------------

    def get_us_powerball_results(self, date=None):
        """US Powerball results."""
        return self._by_date("/api/get_us_powerball_results", date)

    def get_megamillions_results(self, date=None):
        """US Mega Millions results."""
        return self._by_date("/api/get_megamillions_results", date)

    # --- Russia (Gosloto: many draws a day) -----------------------------

    def _gosloto(self, path, date, draw_id):
        _check_date("date", date)
        if draw_id is not None:
            draw_id = str(draw_id)
        return self._get(path, {"date": date, "draw_id": draw_id})

    def get_gosloto_6_45_results(self, date=None, draw_id=None):
        """Gosloto 6/45 results. Omit both params for the latest draw.

        ``date`` (YYYY-MM-DD) returns every draw that day, newest first.
        ``draw_id`` returns that single draw; the server ignores it when
        ``date`` is also given.
        """
        return self._gosloto("/api/get_gosloto_6_45_results", date, draw_id)

    def get_gosloto_7_49_results(self, date=None, draw_id=None):
        """Gosloto 7/49 results. Same params as :meth:`get_gosloto_6_45_results`."""
        return self._gosloto("/api/get_gosloto_7_49_results", date, draw_id)

    def get_gosloto_5_36_results(self, date=None, draw_id=None):
        """Gosloto 5/36 results. Same params as :meth:`get_gosloto_6_45_results`."""
        return self._gosloto("/api/get_gosloto_5_36_results", date, draw_id)

    # --- Horse racing ---------------------------------------------------

    def get_horse_racing_meetings(self, from_date=None, to_date=None):
        """List race meetings. ``from_date`` defaults to 7 days ago and
        ``to_date`` to today (server-side, South African time). The span may
        not exceed 7 days, including when only one end is given (the other end
        then takes its default). This is validated client-side to avoid a
        round trip the server would reject with HTTP 400.
        """
        _check_date("from_date", from_date)
        _check_date("to_date", to_date)
        if from_date or to_date:
            today = _sast_today()
            start = _parse_date("from_date", from_date) if from_date else today - _timedelta(days=7)
            end = _parse_date("to_date", to_date) if to_date else today
            span = (end - start).days
            if span < 0:
                raise ValidationError(
                    "to_date must not be before from_date (to_date defaults to "
                    "today and from_date to 7 days ago)."
                )
            if span > 7:
                raise ValidationError(
                    "Date range too wide: a maximum of 7 days can be queried per "
                    "call (to_date defaults to today and from_date to 7 days ago)."
                )
        return self._get(
            "/api/get_horse_racing_meetings",
            {"from_date": from_date, "to_date": to_date},
        )

    def get_horse_racing_results(self, date=None, venue=None):
        """Full race card for one venue on one day. ``date`` and ``venue``
        are both required (e.g. venue ``Greyville``, ``Kenilworth``)."""
        if not date or not venue:
            raise ValidationError("date and venue are both required for a race card.")
        _check_date("date", date)
        return self._get(
            "/api/get_horse_racing_results", {"date": date, "venue": venue}
        )

    def get_horse_racing_race(self, date=None, venue=None, race_no=None):
        """Runner table for a single race. ``date``, ``venue`` and ``race_no``
        (1-based) are all required."""
        if not date or not venue or race_no is None:
            raise ValidationError(
                "date, venue and race_no are all required for a runner table."
            )
        _check_date("date", date)
        return self._get(
            "/api/get_horse_racing_race",
            {"date": date, "venue": venue, "race_no": race_no},
        )

    # --- Number generators ----------------------------------------------

    def generate_random_numbers(self, game=None, lines=None):
        """Generate random lines for ``game``. ``lines`` is a whole number from
        1 to 500 (defaults to 1 server-side); one request costs a single API
        call regardless of line count.

        The response shape depends on the game (plain arrays, or objects with
        ``powerball`` / ``lucky_stars`` / ``mega_ball`` / ``bonus_ball``), so
        the parsed JSON is returned as-is.
        """
        if not game:
            raise ValidationError("game is required.")
        if lines is not None and (
            isinstance(lines, bool) or not isinstance(lines, int) or not 1 <= lines <= 500
        ):
            raise ValidationError(
                f"lines must be a whole number from 1 to 500, got {lines!r}."
            )
        return self._get(
            "/api/generate_random_numbers", {"game": game, "lines": lines}
        )

    def text_to_lucky_numbers(self, game=None, text=None):
        """Deterministically turn ``text`` into lucky numbers for ``game``
        (same text always yields the same numbers). POST: ``api_key`` and
        ``game`` travel as query params, ``text`` in the JSON body."""
        if not game:
            raise ValidationError("game is required.")
        if not text:
            raise ValidationError("text is required.")
        return self._post(
            "/api/text_to_lucky_numbers",
            params={"game": game},
            json_body={"text": text},
        )

    # --- Analysis -------------------------------------------------------

    def get_hot_cold_numbers(self, product=None):
        """Top 10 hot and cold numbers for ``product``."""
        if not product:
            raise ValidationError("product is required.")
        return self._get("/api/get_hot_cold_numbers_stats", {"product": product})

    def get_number_frequencies(self, product=None):
        """Per-number draw frequencies for ``product``."""
        if not product:
            raise ValidationError("product is required.")
        return self._get("/api/get_number_frequencies", {"product": product})

    def get_number_pairs(self, product=None):
        """Top 10 most-drawn number pairs for ``product``."""
        if not product:
            raise ValidationError("product is required.")
        return self._get("/api/get_number_pairs", {"product": product})

    # --- Checkers (SA games only) ---------------------------------------

    @staticmethod
    def _as_lines(played_numbers):
        """Normalise ``played_numbers`` to a list of lines.

        A list of lists is N lines; a flat list of numbers is a single line.
        A mix of the two is rejected (the server would answer HTTP 400).
        """
        is_line = [isinstance(item, (list, tuple)) for item in played_numbers]
        if all(is_line):
            return [list(line) for line in played_numbers]
        if not any(is_line):
            return [list(played_numbers)]
        raise ValidationError(
            "played_numbers must be one line of numbers or a list of lines, not a mix."
        )

    def _check(self, path, game, date, played_numbers, max_lines, wrap_single):
        if not game:
            raise ValidationError("game is required (SA games only).")
        if not date:
            raise ValidationError("date is required (YYYY-MM-DD).")
        _check_date("date", date)
        if not played_numbers:
            raise ValidationError("played_numbers is required.")
        lines = self._as_lines(played_numbers)
        if len(lines) > max_lines:
            raise ValidationError(
                f"Too many lines: {len(lines)} supplied, but this endpoint accepts "
                f"at most {max_lines} per request."
            )
        # The bulk endpoint requires a list of lines, so a flat single line is
        # wrapped into [line]; the 10-line checker accepts either shape as-is.
        body = lines if wrap_single else played_numbers
        # api_key, game and date are query params; played_numbers is the body.
        return self._post(
            path,
            params={"game": game, "date": date},
            json_body={"played_numbers": body},
        )

    def check_played_numbers(self, game=None, date=None, played_numbers=None):
        """Check played lines against a SA draw. Up to 10 lines, costs 1 call.
        ``played_numbers`` is a single line ``[1, 6, 29, 11, 15, 17]`` or a list
        of lines. For Powerball games the last number is the Powerball."""
        return self._check(
            "/api/check_played_numbers", game, date, played_numbers,
            max_lines=10, wrap_single=False,
        )

    def bulk_check_numbers(self, game=None, date=None, played_numbers=None):
        """Bulk-check up to 500 lines against a SA draw.

        ``played_numbers`` is a list of lines; a single flat line is wrapped
        into ``[line]`` for you (the endpoint requires a list of lines).

        Cost: subscription keys pay 1 call per line (50 lines = 50 calls).
        Older token-based keys pay 5 tokens per 50 lines or part thereof.
        """
        return self._check(
            "/api/bulk_check_numbers", game, date, played_numbers,
            max_lines=500, wrap_single=True,
        )

    # --- Account --------------------------------------------------------

    def check_balance(self):
        """Remaining calls and subscription status. Free - consumes no API
        calls. Note the path has no ``/api/`` prefix and the key rides in the
        JSON body (the only endpoint that takes it there).

        Account states are reported, not raised: a pending, expired or absent
        subscription comes back in the body, and so does a capped plan that is
        out of credits (HTTP 403 with ``status: "error"`` plus the usage
        fields). An unknown key (HTTP 404) raises :class:`AuthError`.

        Fields vary by billing model. For subscription keys they include
        ``subscription_status`` (the raw status, e.g. ``active``, ``pending``,
        ``expired``, ``cancelled``, or ``none`` when no plan has been chosen),
        ``subscription_state`` (derived: ``active``, ``cancelling``,
        ``expired``, ``invoice_cancelled`` or ``none``),
        ``subscription_period_months``, ``tier``, ``monthly_limit``, ``used``,
        ``remaining``, ``subscription_end``, ``days_until_expiry`` and
        ``usage_breakdown`` (per-key usage when the account has sub-keys).
        A key with no API plan gets ``push_subscription`` (the active Webhook
        Push subscription, or None) instead.
        """
        try:
            return self._post(
                "/check_api_key_balance",
                api_key_in_body=True,
                raise_on_error_body=False,
                report_statuses=(403,),
            )
        except APIError as exc:
            if type(exc) is APIError and exc.status_code == 404:
                raise AuthError(str(exc), exc.status_code, exc.response) from None
            raise
