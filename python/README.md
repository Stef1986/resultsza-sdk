# resultsza-sdk (Python)

Official Python client for the [ResultsZA lottery API](https://resultsza.co.za/api_docs) - Lotto, Powerball, EuroMillions, UK49s, Gosloto and horse racing results, number tools, result checkers, and lottery webhook verification. It builds the request, handles errors, and hands you back the parsed JSON.

> Official ResultsZA SDK. Not affiliated with the South African National Lottery, UK 49's, or any national lottery or racing operator. Always verify results on the official operator's site before claiming a prize.

## Install

```bash
pip install resultsza-sdk
```

Or from source while it's in development:

```bash
pip install -e "python/[dev]"
```

## Quickstart

Create a free account at **[resultsza.co.za/signup](https://resultsza.co.za/signup)**, then generate your API key in **My Dashboard**. Buy a plan at [resultsza.co.za/api-pricing](https://resultsza.co.za/api-pricing). Then:

```python
import os
from resultsza import ResultsZA

client = ResultsZA(api_key=os.environ["RESULTSZA_API_KEY"])

client.get_lotto_results()                          # latest draw
client.get_lotto_results(date="2026-07-08")         # a specific draw
client.get_gosloto_6_45_results(date="2026-08-06") # every draw that day
client.get_hot_cold_numbers(product="Powerball")
client.generate_random_numbers(game="Lotto", lines=5)
client.check_balance()                              # free - no calls used
```

The API key is read from an argument or your own environment variable - it is never hardcoded. If a key ever appears in a URL or error, the client redacts it.

Bad input (a malformed date, an out-of-range `lines`, a meetings span over 7 days, too many checker lines) is rejected client-side with `ValidationError` before any request is sent, which saves a round trip.

## Supported endpoints

| Method | Endpoint |
|---|---|
| `get_daily_lotto_results(date=None)` | Daily Lotto |
| `get_lotto_results(date=None)` | Lotto |
| `get_lotto_plus_1_results(date=None)` | Lotto Plus 1 |
| `get_lotto_5_max_results(date=None)` | Lotto 5 Max |
| `get_sa_powerball_results(date=None)` | SA Powerball |
| `get_powerball_xtra_results(date=None)` | Powerball Xtra |
| `get_kenya_lotto_results(date=None, draw_type=None)` | Kenya Lotto (`draw_type`: `daily`/`jackpot`) |
| `get_nigeria_lotto_results(game=None, date=None)` | Nigeria (Premier Lotto) |
| `get_ghana_lotto_results(game=None, date=None)` | Ghana Lotto |
| `get_uk49s_results(game, date=None)` | UK 49's (`game` required) |
| `get_euromillions_results(date=None)` | EuroMillions |
| `get_irish_lotto_results(date=None)` | Irish Lotto |
| `get_us_powerball_results(date=None)` | US Powerball |
| `get_megamillions_results(date=None)` | US Mega Millions |
| `get_gosloto_6_45_results(date=None, draw_id=None)` | Gosloto 6/45 |
| `get_gosloto_7_49_results(date=None, draw_id=None)` | Gosloto 7/49 |
| `get_gosloto_5_36_results(date=None, draw_id=None)` | Gosloto 5/36 |
| `get_horse_racing_meetings(from_date=None, to_date=None)` | Race meetings (max 7-day span) |
| `get_horse_racing_results(date, venue)` | Full race card |
| `get_horse_racing_race(date, venue, race_no)` | Single-race runner table |
| `generate_random_numbers(game, lines=None)` | Random line generator (`lines` 1 to 500) |
| `text_to_lucky_numbers(game, text)` | Deterministic text to numbers |
| `get_hot_cold_numbers(product)` | Hot & cold numbers |
| `get_number_frequencies(product)` | Per-number frequencies |
| `get_number_pairs(product)` | Top number pairs |
| `check_played_numbers(game, date, played_numbers)` | Checker - up to 10 lines |
| `bulk_check_numbers(game, date, played_numbers)` | Bulk checker - up to 500 lines (see cost below) |
| `check_balance()` | Remaining calls & subscription status (free) |

Gosloto draws many times a day: `date` returns every draw that day, newest first, and `draw_id` returns one draw (ignored when `date` is given). Omit both for the latest draw.

**Checker cost.** `check_played_numbers` costs 1 call for up to 10 lines. `bulk_check_numbers` costs 1 call per line on subscription keys (50 lines = 50 calls, max 500 lines); the "5 calls per 50 lines" rule applies only to older token-based keys. Pass `played_numbers` as a list of lines; a single flat line is wrapped into `[line]` for you.

See the [full API docs](https://resultsza.co.za/api_docs) for response shapes. Parameters that accept only specific values (`game`, `product`, `venue`, `draw_type`) are listed under [Games and parameter values](#games-and-parameter-values) below.

## Games and parameter values

Some parameters only accept specific values. Here they are in full.

**South African games** - used by the SA result endpoints, both checkers, and the generators:
`Daily Lotto`, `Lotto`, `Lotto Plus 1`, `Lotto 5 Max`, `Powerball`, `Powerball Xtra`

**Checker games** - `check_played_numbers` / `bulk_check_numbers` `game`: the six SA games above. For draw dates before 2026-06-01 the legacy games `Daily Lotto Plus`, `Lotto Plus 2` and `Powerball Plus` are also accepted.

**UK 49's** - `get_uk49s_results(game=...)`, required:
`UK49s Brunchtime`, `UK49s Lunchtime`, `UK49s Drivetime`, `UK49s Teatime`

**Kenya draw type** - `get_kenya_lotto_results(draw_type=...)`:
`daily` (hourly draws) or `jackpot` (Wed/Sat). Omit for both.

**Horse racing venues** - `get_horse_racing_results` / `get_horse_racing_race` `venue`:
every South African racecourse, e.g. `Greyville`, `Kenilworth`, `Fairview`, `Turffontein`, `Vaal`, `Scottsville`, `Durbanville`. Use the venue name exactly as `get_horse_racing_meetings` returns it.

**Ghana Lotto games** - `get_ghana_lotto_results(game=...)`, optional (omit to return every game drawn on that date):
`Ghana Monday Special`, `Ghana Lucky Tuesday`, `Ghana Mid-Week`, `Ghana Fortune Thursday`, `Ghana Friday Bonanza`, `Ghana National Weekly`, `Ghana Sunday Aseda`, `Ghana VAG Lotto`, `Ghana Noon Rush`, `Ghana Daywa 5/39`

**Nigeria (Premier Lotto) games** - `get_nigeria_lotto_results(game=...)`, optional (omit to return every game drawn on that date; Nigeria draws 6 of these per day):

<details><summary>25 game names</summary>

`PREMIER 06`, `PREMIER ASEDA`, `PREMIER BINGO`, `PREMIER BONANZA`, `PREMIER CLUB MASTER`, `PREMIER DIAMOND`, `PREMIER ENUGU`, `PREMIER FAIRCHANCE`, `PREMIER FORTUNE`, `PREMIER GOLD`, `PREMIER INTERNATIONAL`, `PREMIER JACKPOT`, `PREMIER KING`, `PREMIER LUCKY`, `PREMIER LUCKY G`, `PREMIER MARK II`, `PREMIER METRO`, `PREMIER MIDWEEK`, `PREMIER MSP`, `PREMIER NATIONAL`, `PREMIER PEOPLES`, `PREMIER ROYAL`, `PREMIER SUPER`, `PREMIER TOTA`, `PREMIER VAG`
</details>

**Gosloto** - `get_gosloto_6_45_results` / `get_gosloto_7_49_results` / `get_gosloto_5_36_results`: no game parameter. Generators and stats use the names `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

**Number generator / text-to-lucky games** - `generate_random_numbers` / `text_to_lucky_numbers` `game`:
the SA games above, the four UK 49's variants above, plus `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, `Ghana Lotto`, `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

**Hot/cold, frequencies, pairs** - `product`: the SA games above, plus `UK49s` (all four draws together) and the four UK 49's variants, `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Kenya Mega Jackpot`, `Nigeria Lotto` (all Premier games together) and each of the 25 Nigeria game names above, `Ghana Lotto` (all Ghana games together) and each of the 10 Ghana game names above, `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

Dates are always `YYYY-MM-DD` (a real calendar date); anything else raises `ValidationError` before a request is sent.

## Errors

Failures raise typed exceptions so you can handle them predictably:

```python
import time

from resultsza.exceptions import (
    ResultsZAError,            # base class
    APIError,                  # any error response (status_code, response)
    BadRequestError,           # invalid parameters (HTTP 400)
    ValidationError,           # invalid parameters caught client-side, no request sent
    AuthError,                 # the API refused the key (HTTP 401)
    QuotaExceededError,        # AuthError: no calls left this month / tokens used up
    SubscriptionError,         # AuthError: subscription not active
    SubscriptionExpiredError,  # SubscriptionError: subscription or key expired
    SubscriptionPendingError,  # SubscriptionError: reserved, see below
    RateLimitError,            # HTTP 429: retry_after, cooldown_remaining
)

try:
    client.get_lotto_results(date="2026-07-08")
except QuotaExceededError:
    ...  # buy a top-up or upgrade
except SubscriptionExpiredError:
    ...  # renew
except AuthError as exc:
    print("key problem:", exc)
except RateLimitError as exc:
    time.sleep(exc.retry_after or 60)
except BadRequestError as exc:
    print(exc.status_code, exc.response)
```

How responses map to exceptions:

- **HTTP 401** (every key problem) is mapped by its message: an expired subscription or key raises `SubscriptionExpiredError`, an inactive subscription raises `SubscriptionError`, an out-of-credits or quota message raises `QuotaExceededError`, and anything else raises `AuthError`. All of these are subclasses of `AuthError`, so `except AuthError` catches every key problem.
- `SubscriptionPendingError` is reserved: the API does not currently send a pending-specific message on data endpoints. Use `check_balance()` to see a pending subscription.
- **HTTP 429** raises `RateLimitError` with `retry_after`, `cooldown`, `cooldown_remaining`, and the `X-RateLimit-*` headers as `limit`, `remaining` and `reset`.
- **HTTP 400** raises `BadRequestError`. Client-side checks raise `ValidationError`, a subclass of both `BadRequestError` and `ValueError` (so code written for 0.1.x that catches `ValueError` still works).
- **HTTP 500** and anything else raise `APIError`.

`check_balance()` is diagnostic: it returns the body rather than raising for account states (pending, expired, no subscription, or a capped plan out of credits, which the API sends as HTTP 403). An unknown key raises `AuthError`. New fields to look for: `subscription_status` (can be `none`), `subscription_state`, `subscription_period_months`, `usage_breakdown` and `push_subscription`.

## Webhooks

ResultsZA can push results to your endpoint the moment they're published. Register your endpoint URL and get your signing secret in the **[subscriber portal](https://resultsza.co.za/portal/login)** under **Push Settings** (there is no webhook API) - this SDK helps you *receive* those deliveries safely.

```python
from resultsza.webhook import verify_and_parse, SIGNATURE_HEADER
from resultsza.exceptions import InvalidSignatureError

# raw = the exact request BYTES (not re-serialized JSON)
# signature = request header "X-ResultsZA-Signature"
try:
    event = verify_and_parse(raw, signature, secret)
except InvalidSignatureError:
    ...  # reject: return 401

if event.is_test:        # portal test sends (result.test)
    ...
event.game, event.data, event.dedupe_key()
```

Three rules a correct receiver must follow, all shown in [`examples/webhook_receiver_flask.py`](examples/webhook_receiver_flask.py):

1. **Verify against the raw request bytes**, not a re-serialized copy of the JSON.
2. **Return a 2xx within 10 seconds**, then do slow work afterwards.
3. **Deduplicate** - delivery is at-least-once and unordered (`event.dedupe_key()` helps; horse-racing pushes are keyed on `race_key`, one per race).

Endpoints must be **HTTPS**. See the [webhook docs](https://resultsza.co.za/webhook-docs).

## Rate limits

The Unlimited tier is capped at 60 requests/minute; exceeding it triggers a 5-minute cooldown (`RateLimitError.retry_after` says how long to wait). Other tiers are bounded by a monthly quota (`QuotaExceededError` when it runs out). Check your usage any time with `client.check_balance()` - it doesn't consume a call. See [pricing](https://resultsza.co.za/api-pricing) for tiers.

## Testing

The test suite mocks the HTTP layer, so it needs no API key and never calls the production API:

```bash
pip install -e "python/[dev]"
cd python && pytest
```

## Links

- **Get an API key:** create a free account at https://resultsza.co.za/signup, then generate the key in My Dashboard
- **Set up webhooks (portal Push Settings):** https://resultsza.co.za/portal/login
- API docs: https://resultsza.co.za/api_docs
- Webhook docs: https://resultsza.co.za/webhook-docs
- Pricing & plans: https://resultsza.co.za/api-pricing

MIT licensed.
