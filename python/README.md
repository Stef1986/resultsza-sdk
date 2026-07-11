# resultsza-sdk (Python)

Official Python client for the [ResultsZA lottery API](https://resultsza.co.za/api_docs) - Lotto, Powerball, EuroMillions, UK49s and horse racing results, number tools, result checkers, and lottery webhook verification. It builds the request, handles errors, and hands you back the parsed JSON.

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

Get an API key at **[resultsza.co.za/generate_api_key](https://resultsza.co.za/generate_api_key)**, then:

```python
import os
from resultsza import ResultsZA

client = ResultsZA(api_key=os.environ["RESULTSZA_API_KEY"])

client.get_lotto_results()                          # latest draw
client.get_lotto_results(date="2026-07-08")         # a specific draw
client.get_hot_cold_numbers(product="Powerball")
client.generate_random_numbers(game="Lotto", lines=5)
client.check_balance()                              # free - no calls used
```

The API key is read from an argument or your own environment variable - it is never hardcoded. If a key ever appears in a URL or error, the client redacts it.

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
| `get_horse_racing_meetings(from_date=None, to_date=None)` | Race meetings (max 7-day span) |
| `get_horse_racing_results(date, venue)` | Full race card |
| `get_horse_racing_race(date, venue, race_no)` | Single-race runner table |
| `generate_random_numbers(game, lines=None)` | Random line generator |
| `text_to_lucky_numbers(game, text)` | Deterministic text to numbers |
| `get_hot_cold_numbers(product)` | Hot & cold numbers |
| `get_number_frequencies(product)` | Per-number frequencies |
| `get_number_pairs(product)` | Top number pairs |
| `check_played_numbers(game, date, played_numbers)` | Checker - up to 10 lines |
| `bulk_check_numbers(game, date, played_numbers)` | Bulk checker - up to 500 lines |
| `check_balance()` | Remaining calls & subscription status (free) |

See the [full API docs](https://resultsza.co.za/api_docs) for response shapes. Parameters that accept only specific values (`game`, `product`, `venue`, `draw_type`) are listed under [Games and parameter values](#games-and-parameter-values) below.

## Games and parameter values

Some parameters only accept specific values. Here they are in full.

**South African games** - used by the SA result endpoints, both checkers, and the generators:
`Daily Lotto`, `Lotto`, `Lotto Plus 1`, `Lotto 5 Max`, `Powerball`, `Powerball Xtra`

**UK 49's** - `get_uk49s_results(game=...)`, required:
`UK49s Brunchtime`, `UK49s Lunchtime`, `UK49s Drivetime`, `UK49s Teatime`

**Kenya draw type** - `get_kenya_lotto_results(draw_type=...)`:
`daily` (hourly draws) or `jackpot` (Wed/Sat). Omit for both.

**Horse racing venues** - `get_horse_racing_results` / `get_horse_racing_race` `venue`:
`Greyville`, `Kenilworth`, `Fairview`, `Vaal`

**Ghana Lotto games** - `get_ghana_lotto_results(game=...)`, optional (omit to return every game drawn on that date):
`Ghana Monday Special`, `Ghana Lucky Tuesday`, `Ghana Mid-Week`, `Ghana Fortune Thursday`, `Ghana Friday Bonanza`, `Ghana National Weekly`, `Ghana Sunday Aseda`, `Ghana VAG Lotto`, `Ghana Noon Rush`, `Ghana Daywa 5/39`

**Nigeria (Premier Lotto) games** - `get_nigeria_lotto_results(game=...)`, optional (omit to return every game drawn on that date; Nigeria draws 6 of these per day):

<details><summary>25 game names</summary>

`PREMIER 06`, `PREMIER ASEDA`, `PREMIER BINGO`, `PREMIER BONANZA`, `PREMIER CLUB MASTER`, `PREMIER DIAMOND`, `PREMIER ENUGU`, `PREMIER FAIRCHANCE`, `PREMIER FORTUNE`, `PREMIER GOLD`, `PREMIER INTERNATIONAL`, `PREMIER JACKPOT`, `PREMIER KING`, `PREMIER LUCKY`, `PREMIER LUCKY G`, `PREMIER MARK II`, `PREMIER METRO`, `PREMIER MIDWEEK`, `PREMIER MSP`, `PREMIER NATIONAL`, `PREMIER PEOPLES`, `PREMIER ROYAL`, `PREMIER SUPER`, `PREMIER TOTA`, `PREMIER VAG`
</details>

**Number generator / text-to-lucky games** - `generate_random_numbers` / `text_to_lucky_numbers` `game`:
the SA games above, the four UK 49's variants above, plus `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, `Ghana Lotto`.

**Hot/cold, frequencies, pairs** - `product`: the SA games are the primary set; `UK49s`, `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, and `Ghana Lotto` are also supported.

Dates are always `YYYY-MM-DD`.

## Errors

Failures raise typed exceptions so you can handle them predictably:

```python
from resultsza.exceptions import (
    ResultsZAError,          # base class
    BadRequestError,         # invalid parameters
    AuthError,               # missing/invalid key
    RateLimitError,          # rate limit / cooldown
    SubscriptionExpiredError,
    SubscriptionPendingError,
)

try:
    client.get_lotto_results(date="not-a-date")
except BadRequestError as exc:
    print(exc.status_code, exc.response)
```

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
3. **Deduplicate** - delivery is at-least-once and unordered (`event.dedupe_key()` helps).

Endpoints must be **HTTPS**. See the [webhook docs](https://resultsza.co.za/webhook-docs).

## Rate limits

The Unlimited tier is capped at 60 requests/minute; exceeding it triggers a 5-minute cooldown. Other tiers are bounded by a monthly quota. Check your usage any time with `client.check_balance()` - it doesn't consume a call. See [pricing](https://resultsza.co.za) for tiers.

## Testing

The test suite mocks the HTTP layer, so it needs no API key and never calls the production API:

```bash
pip install -e "python/[dev]"
cd python && pytest
```

## Links

- **Get an API key:** https://resultsza.co.za/generate_api_key
- **Set up webhooks (portal Push Settings):** https://resultsza.co.za/portal/login
- API docs: https://resultsza.co.za/api_docs
- Webhook docs: https://resultsza.co.za/webhook-docs
- Pricing & plans: https://resultsza.co.za

MIT licensed.
