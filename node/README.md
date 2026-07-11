# resultsza-sdk (Node / TypeScript)

Thin Node/TypeScript client for the [ResultsZA API](https://resultsza.co.za/api_docs) - lottery and horse racing results, number tools, and result checkers. It builds the request, handles errors, and returns the parsed JSON. Zero runtime dependencies (native `fetch` and `node:crypto`).

> Unofficial tooling for the ResultsZA API. Not affiliated with the South African National Lottery, UK 49's, or any national lottery or racing operator. Always verify results on the official operator's site before claiming a prize.

## Install

```bash
npm install resultsza-sdk
```

Requires Node 20+ (for global `fetch`). Ships ESM and CommonJS builds with TypeScript types.

## Quickstart

Get an API key at **[resultsza.co.za/generate_api_key](https://resultsza.co.za/generate_api_key)**, then:

```ts
import { ResultsZA } from "resultsza-sdk";

const client = new ResultsZA({ apiKey: process.env.RESULTSZA_API_KEY! });

await client.getLottoResults();                       // latest draw
await client.getLottoResults({ date: "2026-07-08" }); // a specific draw
await client.getHotColdNumbers({ product: "Powerball" });
await client.generateRandomNumbers({ game: "Lotto", lines: 5 });
await client.checkBalance();                           // free - no calls used
```

The API key is passed in code (read it from your own environment variable) and is never logged. If a key ever appears in a URL or error, the client redacts it.

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
| `getHorseRacingMeetings({ fromDate?, toDate? })` | Race meetings (max 7-day span) |
| `getHorseRacingResults({ date, venue })` | Full race card |
| `getHorseRacingRace({ date, venue, raceNo })` | Single-race runner table |
| `generateRandomNumbers({ game, lines? })` | Random line generator |
| `textToLuckyNumbers({ game, text })` | Deterministic text to numbers |
| `getHotColdNumbers({ product })` | Hot & cold numbers |
| `getNumberFrequencies({ product })` | Per-number frequencies |
| `getNumberPairs({ product })` | Top number pairs |
| `checkPlayedNumbers({ game, date, playedNumbers })` | Checker - up to 10 lines |
| `bulkCheckNumbers({ game, date, playedNumbers })` | Bulk checker - up to 500 lines |
| `checkBalance()` | Remaining calls & subscription status (free) |

Responses are returned as parsed JSON (untyped): some endpoints vary their shape per game, so you inspect the object directly. Parameters that accept only specific values (`game`, `product`, `venue`, `drawType`) are listed under [Games and parameter values](#games-and-parameter-values) below. See the [full API docs](https://resultsza.co.za/api_docs) for response shapes.

## Games and parameter values

Some parameters only accept specific values. Here they are in full.

**South African games** - used by the SA result endpoints, both checkers, and the generators:
`Daily Lotto`, `Lotto`, `Lotto Plus 1`, `Lotto 5 Max`, `Powerball`, `Powerball Xtra`

**UK 49's** - `getUk49sResults({ game })`, required:
`UK49s Brunchtime`, `UK49s Lunchtime`, `UK49s Drivetime`, `UK49s Teatime`

**Kenya draw type** - `getKenyaLottoResults({ drawType })`:
`daily` (hourly draws) or `jackpot` (Wed/Sat). Omit for both.

**Horse racing venues** - `getHorseRacingResults` / `getHorseRacingRace` `venue`:
`Greyville`, `Kenilworth`, `Fairview`, `Vaal`

**Ghana Lotto games** - `getGhanaLottoResults({ game })`, optional (omit to return every game drawn on that date):
`Ghana Monday Special`, `Ghana Lucky Tuesday`, `Ghana Mid-Week`, `Ghana Fortune Thursday`, `Ghana Friday Bonanza`, `Ghana National Weekly`, `Ghana Sunday Aseda`, `Ghana VAG Lotto`, `Ghana Noon Rush`, `Ghana Daywa 5/39`

**Nigeria (Premier Lotto) games** - `getNigeriaLottoResults({ game })`, optional (omit to return every game drawn on that date; Nigeria draws 6 of these per day):

<details><summary>25 game names</summary>

`PREMIER 06`, `PREMIER ASEDA`, `PREMIER BINGO`, `PREMIER BONANZA`, `PREMIER CLUB MASTER`, `PREMIER DIAMOND`, `PREMIER ENUGU`, `PREMIER FAIRCHANCE`, `PREMIER FORTUNE`, `PREMIER GOLD`, `PREMIER INTERNATIONAL`, `PREMIER JACKPOT`, `PREMIER KING`, `PREMIER LUCKY`, `PREMIER LUCKY G`, `PREMIER MARK II`, `PREMIER METRO`, `PREMIER MIDWEEK`, `PREMIER MSP`, `PREMIER NATIONAL`, `PREMIER PEOPLES`, `PREMIER ROYAL`, `PREMIER SUPER`, `PREMIER TOTA`, `PREMIER VAG`
</details>

**Number generator / text-to-lucky games** - `generateRandomNumbers` / `textToLuckyNumbers` `game`:
the SA games above, the four UK 49's variants above, plus `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, `Ghana Lotto`.

**Hot/cold, frequencies, pairs** - `product`: the SA games are the primary set; `UK49s`, `EuroMillions`, `Irish Lotto`, `US Powerball`, `Mega Millions`, `Kenya Lotto`, `Nigeria Lotto`, and `Ghana Lotto` are also supported.

Dates are always `YYYY-MM-DD`.

## Errors

Failures throw (reject with) typed errors:

```ts
import { BadRequestError, SubscriptionExpiredError } from "resultsza-sdk";

try {
  await client.getLottoResults({ date: "not-a-date" });
} catch (err) {
  if (err instanceof BadRequestError) {
    console.error(err.statusCode, err.response);
  }
}
```

Classes: `ResultsZAError` (base), `APIError`, `BadRequestError`, `AuthError`, `RateLimitError`, `SubscriptionError`, `SubscriptionExpiredError`, `SubscriptionPendingError`, `InvalidSignatureError`.

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

A correct receiver must: verify against the raw bytes (not re-serialized JSON), return 2xx within 10 seconds, and deduplicate at-least-once deliveries. See [`examples/webhookReceiverExpress.ts`](examples/webhookReceiverExpress.ts) and the [webhook docs](https://resultsza.co.za/webhook-docs).

## Rate limits

The Unlimited tier allows 60 requests/minute; exceeding it triggers a 5-minute cooldown. Other tiers are bounded by a monthly quota. Check usage any time with `client.checkBalance()` - it consumes no calls.

## Development

```bash
npm install
npm test          # vitest, HTTP layer mocked - no API key needed
npm run typecheck
npm run build     # tsup -> dual ESM/CJS + types in dist/
```

## Links

- **Get an API key:** https://resultsza.co.za/generate_api_key
- **Set up webhooks (portal Push Settings):** https://resultsza.co.za/portal/login
- API docs: https://resultsza.co.za/api_docs
- Webhook docs: https://resultsza.co.za/webhook-docs
- Pricing & plans: https://resultsza.co.za

MIT licensed.
