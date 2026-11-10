# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0]

Brings both SDKs in line with the current API. Python and Node/TypeScript stay feature-for-feature identical.

### Added

- Gosloto result endpoints: `get_gosloto_6_45_results`, `get_gosloto_7_49_results`, `get_gosloto_5_36_results` (Node: `getGosloto645Results`, `getGosloto749Results`, `getGosloto536Results`). Optional `date` returns every draw that day, newest first; optional `draw_id` (Node: `drawId`) returns a single draw.
- `QuotaExceededError` (a subclass of `AuthError`) for out-of-credits and quota messages: "You are out of API credits", "You have used all your API credits for this month", "Monthly API limit would be exceeded", "Daily API request quota reached", plus the token and backlink equivalents.
- `ValidationError` (a subclass of `BadRequestError`; in Python also a `ValueError`) for every client-side check, raised before any HTTP request.
- Strict client-side date validation: every `date`, `from_date` and `to_date` must be a real calendar date in `YYYY-MM-DD` form.
- `generate_random_numbers` validates `lines` is a whole number from 1 to 500.
- `RateLimitError` now exposes `retry_after`, `cooldown` and `cooldown_remaining` from the 429 body, and `limit`, `remaining` and `reset` from the `X-RateLimit-*` headers (Node: `retryAfter`, `cooldown`, `cooldownRemaining`, `limit`, `remaining`, `reset`).
- Documented the newer `check_balance` fields: `subscription_status` can be `none`, plus `subscription_state`, `subscription_period_months`, `usage_breakdown` and `push_subscription`.

### Changed

- 401 responses are now mapped by message, because the API sends every key problem as 401 without a `subscription_status` field: an expired subscription or key raises `SubscriptionExpiredError`, "Subscription is not active" raises `SubscriptionError`, out-of-credits messages raise `QuotaExceededError`, and anything else raises `AuthError`.
- `SubscriptionError` (and so `SubscriptionExpiredError` and `SubscriptionPendingError`) now extends `AuthError`, so existing `except AuthError` / `instanceof AuthError` code still catches every 401. `SubscriptionPendingError` is kept but reserved: the API does not currently send a pending-specific message on data endpoints.
- Client-side checks (required params, line limits, the meetings span) raise `ValidationError` instead of a bare `ValueError` (Python) or `Error` (Node). Both still match the old `except ValueError` and `instanceof Error` checks.
- `bulk_check_numbers` wraps a flat single line into `[line]` before sending, since the endpoint requires a list of lines. Both checkers reject a mix of numbers and lines client-side.
- Docs, examples and error messages point to https://resultsza.co.za/signup (create a free account, then generate the key in My Dashboard) and https://resultsza.co.za/api-pricing for plans, replacing the old key-generation link.
- READMEs list Gosloto everywhere games are listed, the full stats product list (including Kenya Mega Jackpot and the individual Ghana and Nigeria Premier games), the legacy checker games accepted for draws before 2026-06-01, and all South African racecourses for horse racing.

### Fixed

- `SubscriptionExpiredError` and `SubscriptionPendingError` never fired, because they keyed on a `subscription_status` field the data endpoints do not send.
- `check_balance` raised on the HTTP 403 a capped plan gets when it is out of credits; it now returns that body (with the usage fields) for inspection. An unknown key (HTTP 404) now raises `AuthError` instead of a generic `APIError`.
- `get_horse_racing_meetings` now applies the 7-day span rule when only `from_date` (or only `to_date`) is given, using today's date in South Africa for the server's default.
- `WebhookEvent.dedupe_key()` (Node: `dedupeKey()`) uses `race_key` for horse-racing pushes, so each race gets its own key instead of every race collapsing to `horse_racing`.
- Bulk checker cost text: subscription keys pay 1 call per line (max 500 lines); the "5 calls per 50 lines" rule applies only to older token-based keys.
- The Python module docstring wrongly said POST endpoints send the API key in the JSON body; only `check_balance` does.
- The `check_played_numbers` examples caught only `SubscriptionError`, which never fired; they now show `ValidationError`, `QuotaExceededError`, `SubscriptionError` and `AuthError`.

## [0.1.2]

### Changed

- Documentation and package metadata (descriptions, keywords, README) tuned for discoverability as a lottery API / lottery webhook client. No code or API changes.
- Added a project logo and an FAQ to the README.

## [0.1.1]

### Changed

- Corrected the package descriptions and disclaimers to identify these as the official ResultsZA SDKs. The not-affiliated notice now applies specifically to the national lottery and racing operators, which is the accurate scope.

## [0.1.0]

Initial release - Python and Node/TypeScript SDKs with matching feature sets.

### Added

- `ResultsZA` client (Python and Node/TypeScript) covering all documented API endpoints:
  - Lottery results: SA (Daily Lotto, Lotto, Lotto Plus 1, Lotto 5 Max, SA Powerball, Powerball Xtra), Kenya, Nigeria, Ghana, UK 49's, EuroMillions, Irish Lotto, US Powerball, Mega Millions.
  - Horse racing: meetings, race cards, and single-race runner tables.
  - Number tools: random generator, text-to-lucky, hot/cold, frequencies, pairs.
  - Checkers: single (up to 10 lines) and bulk (up to 500 lines).
  - Free balance & subscription status check.
- Query-parameter authentication with automatic redaction of the API key from URLs and error messages.
- Client-side validation for documented constraints (required game/venue/date params, the 7-day meetings span, and checker line limits) to avoid wasted API calls.
- Typed exceptions: `BadRequestError`, `AuthError`, `RateLimitError`, `SubscriptionExpiredError`, `SubscriptionPendingError`, and `InvalidSignatureError`.
- Webhook receiver toolkit: `verify_webhook_signature`, `parse_event`, `verify_and_parse`, and `WebhookEvent` (with a best-effort `dedupe_key`).
- Examples for results, checkers, horse racing, and webhook receiving (Flask for Python, Express for Node).
- Test suites that mock the HTTP layer, so no API key is required to run them (67 Python tests, 49 Node tests).
- Node package ships ESM + CommonJS builds with TypeScript types and zero runtime dependencies.

[Unreleased]: https://github.com/Stef1986/resultsza-sdk/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Stef1986/resultsza-sdk/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/Stef1986/resultsza-sdk/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/Stef1986/resultsza-sdk/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Stef1986/resultsza-sdk/releases/tag/v0.1.0
