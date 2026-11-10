# resultsza-sdk (Node / TypeScript)

Official Node/TypeScript client for the [ResultsZA lottery API](https://resultsza.co.za/api_docs) - Lotto, Powerball, EuroMillions, UK49s, Gosloto and horse racing results, number tools, result checkers, and lottery webhook verification. It builds the request, handles errors, and returns the parsed JSON. Zero runtime dependencies (native `fetch` and `node:crypto`).

> Official ResultsZA SDK. Not affiliated with the South African National Lottery, UK 49's, or any national lottery or racing operator. Always verify results on the official operator's site before claiming a prize.

## Install

```bash
npm install resultsza-sdk
```

Requires Node 20+ (for global `fetch`). Ships ESM and CommonJS builds with TypeScript types.

## Quickstart

Create a free account at **[resultsza.co.za/signup](https://resultsza.co.za/signup)**, then generate your API key in **My Dashboard**. Buy a plan at [resultsza.co.za/api-pricing](https://resultsza.co.za/api-pricing). Then:

```ts
import { ResultsZA } from "resultsza-sdk";

const client = new ResultsZA({ apiKey: process.env.RESULTSZA_API_KEY! });

await client.getLottoResults();                       // latest draw
await client.getLottoResults({ date: "2026-07-08" }); // a specific draw
await client.getGosloto645Results({ date: "2026-08-06" }); // every draw that day
await client.getHotColdNumbers({ product: "Powerball" });
await client.generateRandomNumbers({ game: "Lotto", lines: 5 });
await client.checkBalance();                           // free - no calls used
```

The API key is passed in code (read it from your own environment variable) and is never logged. If a key ever appears in a URL or error, the client redacts it.

Bad input (a malformed date, an out-of-range `lines`, a meetings span over 7 days, too many checker lines) is rejected client-side with `ValidationError` before any request is sent, which saves a round trip.

## Supported methods

| Method | Endpoint |
|---|---|
| `getDailyLottoResults({ date? })` | Daily Lotto |
| `getLottoResults({ date? })` | Lotto |
| `getLottoPlus1Results({ date? })` | Lotto Plus 1 |
| `getLotto5MaxResults({ date? })` | Lotto 5 Max |
| `getSaPowerballResults({ date? })` | SA Powerball |
| `getPowerballXtraResults({ date? })` | Powerball Xtra |
| `getKenyaLottoResults({ date?, drawType? })` | Kenya Lotto (`drawType`: `daily`/`jackpot`) |
| `getNigeriaLottoResults({ game?, date? })` | Nigeria (Premier Lotto) |
| `getGhanaLottoResults({ game?, date? })` | Ghana Lotto |
| `getUk49sResults({ game, date? })` | UK 49's (`game` required) |
| `getEuromillionsResults({ date? })` | EuroMillions |
| `getIrishLottoResults({ date? })` | Irish Lotto |
| `getUsPowerballResults({ date? })` | US Powerball |
| `getMegamillionsResults({ date? })` | US Mega Millions |
| `getGosloto645Results({ date?, drawId? })` | Gosloto 6/45 |
| `getGosloto749Results({ date?, drawId? })` | Gosloto 7/49 |
| `getGosloto536Results({ date?, drawId? })` | Gosloto 5/36 |
| `getHorseRacingMeetings({ fromDate?, toDate? })` | Race meetings (max 7-day span) |
| `getHorseRacingResults({ date, venue })` | Full race card |
| `getHorseRacingRace({ date, venue, raceNo })` | Single-race runner table |
| `generateRandomNumbers({ game, lines? })` | Random line generator (`lines` 1 to 500) |
| `textToLuckyNumbers({ game, text })` | Deterministic text to numbers |
| `getHotColdNumbers({ product })` | Hot & cold numbers |
| `getNumberFrequencies({ product })` | Per-number frequencies |
| `getNumberPairs({ product })` | Top number pairs |
| `checkPlayedNumbers({ game, date, playedNumbers })` | Checker - up to 10 lines |
| `bulkCheckNumbers({ game, date, playedNumbers })` | Bulk checker - up to 500 lines (see cost below) |
| `checkBalance()` | Remaining calls & subscription status (free) |

Gosloto draws many times a day: `date` returns every draw that day, newest first, and `drawId` returns one draw (ignored when `date` is given). Omit both for the latest draw.

**Checker cost.** `checkPlayedNumbers` costs 1 call for up to 10 lines. `bulkCheckNumbers` costs 1 call per line on subscription keys (50 lines = 50 calls, max 500 lines); the "5 calls per 50 lines" rule applies only to older token-based keys. Pass `playedNumbers` as a list of lines; a single flat line is wrapped into `[line]` for you.

Responses are returned as parsed JSON (untyped): some endpoints vary their shape per game, so you inspect the object directly. Parameters that accept only specific values (`game`, `product`, `venue`, `drawType`) are listed under [Games and parameter values](#games-and-parameter-values) below. See the [full API docs](https://resultsza.co.za/api_docs) for response shapes.

## Games and parameter values

Some parameters only accept specific values. Here they are in full.

**South African games** - used by the SA result endpoints, both checkers, and the generators:
`Daily Lotto`, `Lotto`, `Lotto Plus 1`, `Lotto 5 Max`, `Powerball`, `Powerball Xtra`

**Checker games** - `checkPlayedNumbers` / `bulkCheckNumbers` `game`: the six SA games above. For draw dates before 2026-06-01 the legacy games `Daily Lotto Plus`, `Lotto Plus 2` and `Powerball Plus` are also accepted.

**UK 49's** - `getUk49sResults({ game })`, required:
`UK49s Brunchtime`, `UK49s Lunchtime`, `UK49s Drivetime`, `UK49s Teatime`

**Kenya draw type** - `getKenyaLottoResults({ drawType })`:
`daily` (hourly draws) or `jackpot` (Wed/Sat). Omit for both.

**Horse racing venues** - `getHorseRacingResults` / `getHorseRacingRace` `venue`:
every South African racecourse, e.g. `Greyville`, `Kenilworth`, `Fairview`, `Turffontein`, `Vaal`, `Scottsville`, `Durbanville`. Use the venue name exactly as `getHorseRacingMeetings` returns it.

**Ghana Lotto games** - `getGhanaLottoResults({ game })`, optional (omit to return every game drawn on that date):
`Ghana Monday Special`, `Ghana Lucky Tuesday`, `Ghana Mid-Week`, `Ghana Fortune Thursday`, `Ghana Friday Bonanza`, `Ghana National Weekly`, `Ghana Sunday Aseda`, `Ghana VAG Lotto`, `Ghana Noon Rush`, `Ghana Daywa 5/39`

**Nigeria (Premier Lotto) games** - `getNigeriaLottoResults({ game })`, optional (omit to return every game drawn on that date; Nigeria draws 6 of these per day):

<details><summary>25 game names</summary>

`PREMIER 06`, `PREMIER ASEDA`, `PREMIER BINGO`, `PREMIER BONANZA`, `PREMIER CLUB MASTER`, `PREMIER DIAMOND`, `PREMIER ENUGU`, `PREMIER FAIRCHANCE`, `PREMIER FORTUNE`, `PREMIER GOLD`, `PREMIER INTERNATIONAL`, `PREMIER JACKPOT`, `PREMIER KING`, `PREMIER LUCKY`, `PREMIER LUCKY G`, `PREMIER MARK II`, `PREMIER METRO`, `PREMIER MIDWEEK`, `PREMIER MSP`, `PREMIER NATIONAL`, `PREMIER PEOPLES`, `PREMIER ROYAL`, `PREMIER SUPER`, `PREMIER TOTA`, `PREMIER VAG`
</details>

**Gosloto** - `getGosloto645Results` / `getGosloto749Results` / `getGosloto536Results`: no game parameter. Generators and stats use the names `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

**Number generator / text-to-lucky games** - `generateRandomNumbers` / `textToLuckyNumbers` `game`:
the SA games above, the four UK 49's variants above, plus `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, `Ghana Lotto`, `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

**Hot/cold, frequencies, pairs** - `product`: the SA games above, plus `UK49s` (all four draws together) and the four UK 49's variants, `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Kenya Mega Jackpot`, `Nigeria Lotto` (all Premier games together) and each of the 25 Nigeria game names above, `Ghana Lotto` (all Ghana games together) and each of the 10 Ghana game names above, `Gosloto 6/45`, `Gosloto 7/49`, `Gosloto 5/36`.

Dates are always `YYYY-MM-DD` (a real calendar date); anything else throws `ValidationError` before a request is sent.

## Errors

Failures throw (reject with) typed errors:

```ts
import {
  AuthError,
  BadRequestError,
  QuotaExceededError,
  RateLimitError,
  SubscriptionExpiredError,
} from "resultsza-sdk";

try {
  await client.getLottoResults({ date: "2026-07-08" });
} catch (err) {
  if (err instanceof QuotaExceededError) {
    // buy a top-up or upgrade
  } else if (err instanceof SubscriptionExpiredError) {
    // renew
  } else if (err instanceof AuthError) {
    console.error("key problem:", err.message);
  } else if (err instanceof RateLimitError) {
    const waitMs = (err.retryAfter ?? 60) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } else if (err instanceof BadRequestError) {
    console.error(err.statusCode, err.response);
  }
}
```

Classes: `ResultsZAError` (base), `APIError`, `BadRequestError`, `ValidationError` (client-side, no request sent), `AuthError`, `QuotaExceededError`, `SubscriptionError`, `SubscriptionExpiredError`, `SubscriptionPendingError`, `RateLimitError`, `InvalidSignatureError`.

How responses map to errors:

- **HTTP 401** (every key problem) is mapped by its message: an expired subscription or key throws `SubscriptionExpiredError`, an inactive subscription throws `SubscriptionError`, an out-of-credits or quota message throws `QuotaExceededError`, and anything else throws `AuthError`. All of these extend `AuthError`, so `instanceof AuthError` catches every key problem.
- `SubscriptionPendingError` is reserved: the API does not currently send a pending-specific message on data endpoints. Use `checkBalance()` to see a pending subscription.
- **HTTP 429** throws `RateLimitError` with `retryAfter`, `cooldown`, `cooldownRemaining`, and the `X-RateLimit-*` headers as `limit`, `remaining` and `reset`.
- **HTTP 400** throws `BadRequestError`. Client-side checks throw `ValidationError`, which extends `BadRequestError`.
- **HTTP 500** and anything else throw `APIError`.

`checkBalance()` is diagnostic: it returns the body rather than throwing for account states (pending, expired, no subscription, or a capped plan out of credits, which the API sends as HTTP 403). An unknown key throws `AuthError`. New fields to look for: `subscription_status` (can be `none`), `subscription_state`, `subscription_period_months`, `usage_breakdown` and `push_subscription`.

## Webhooks

Register your endpoint URL and get your signing secret in the [subscriber portal](https://resultsza.co.za/portal/login) under Push Settings (there is no webhook API). This SDK helps you receive those deliveries:

```ts
import { verifyAndParse, InvalidSignatureError, SIGNATURE_HEADER } from "resultsza-sdk";

// raw = the exact request BYTES (Buffer), signature = the X-ResultsZA-Signature header
try {
  const event = verifyAndParse(raw, signature, secret);
  if (event.isTest) return; // portal test send
  process(event.game, event.data, event.dedupeKey());
} catch (err) {
  if (err instanceof InvalidSignatureError) { /* return 401 */ }
}
```

A correct receiver must: verify against the raw bytes (not re-serialized JSON), return 2xx within 10 seconds, and deduplicate at-least-once deliveries (`event.dedupeKey()` helps; horse-racing pushes are keyed on `race_key`, one per race). See [`examples/webhookReceiverExpress.ts`](examples/webhookReceiverExpress.ts) and the [webhook docs](https://resultsza.co.za/webhook-docs).

## Rate limits

The Unlimited tier allows 60 requests/minute; exceeding it triggers a 5-minute cooldown (`RateLimitError.retryAfter` says how long to wait). Other tiers are bounded by a monthly quota (`QuotaExceededError` when it runs out). Check usage any time with `client.checkBalance()` - it consumes no calls. See [pricing](https://resultsza.co.za/api-pricing) for tiers.

## Development

```bash
npm install
npm test          # vitest, HTTP layer mocked - no API key needed
npm run typecheck
npm run build     # tsup -> dual ESM/CJS + types in dist/
```

## Links

- **Get an API key:** create a free account at https://resultsza.co.za/signup, then generate the key in My Dashboard
- **Set up webhooks (portal Push Settings):** https://resultsza.co.za/portal/login
- API docs: https://resultsza.co.za/api_docs
- Webhook docs: https://resultsza.co.za/webhook-docs
- Pricing & plans: https://resultsza.co.za/api-pricing

MIT licensed.
