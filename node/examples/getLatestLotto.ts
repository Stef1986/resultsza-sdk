/**
 * Fetch the latest South African Lotto results.
 *
 *   RESULTSZA_API_KEY=your_key npx tsx examples/getLatestLotto.ts
 *
 * Get an API key at https://resultsza.co.za/generate_api_key
 */
// In your project: import { ResultsZA } from "resultsza-sdk";
import { ResultsZA } from "../src/index";

const client = new ResultsZA({ apiKey: process.env.RESULTSZA_API_KEY! });

// Omit `date` for the most recent draw, or pass "YYYY-MM-DD" for a specific one.
const latest = await client.getLottoResults();
console.log(latest);

// A few more one-liners:
//   await client.getSaPowerballResults();
//   await client.getEuromillionsResults({ date: "2026-07-07" });
//   await client.getUk49sResults({ game: "UK49s Lunchtime" });
//   await client.generateRandomNumbers({ game: "Powerball", lines: 5 });
//   await client.getHotColdNumbers({ product: "Lotto" });
