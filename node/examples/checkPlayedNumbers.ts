/**
 * Check played lines against a South African draw.
 *
 *   RESULTSZA_API_KEY=your_key npx tsx examples/checkPlayedNumbers.ts
 */
// In your project: import { ResultsZA, APIError, SubscriptionError } from "resultsza-sdk";
import { APIError, ResultsZA, SubscriptionError } from "../src/index";

const client = new ResultsZA({ apiKey: process.env.RESULTSZA_API_KEY! });

// Placeholder lines - replace with your own. Up to 10 lines here; use
// client.bulkCheckNumbers(...) for up to 500.
const playedNumbers = [
  [1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12],
];

try {
  const result = await client.checkPlayedNumbers({
    game: "Lotto",
    date: "2026-07-08",
    playedNumbers,
  });
  console.log(result);
} catch (err) {
  if (err instanceof SubscriptionError) {
    console.error(`Subscription not active: ${err.message}`);
  } else if (err instanceof APIError) {
    console.error(`API error (HTTP ${err.statusCode}): ${err.message}`);
  } else {
    throw err;
  }
}
