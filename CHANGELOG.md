# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Stef1986/resultsza-sdk/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/Stef1986/resultsza-sdk/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/Stef1986/resultsza-sdk/releases/tag/v0.1.0
