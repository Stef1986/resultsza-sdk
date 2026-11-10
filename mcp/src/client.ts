import { ResultsZA } from "resultsza-sdk";

/**
 * The only host this server ever talks to. Deliberately not configurable
 * (no env var, argument or setting), so a prompt-injected tool call cannot
 * send the user's key anywhere else.
 */
export const BASE_URL = "https://resultsza.co.za";

export function buildClient(apiKey: string, fetchImpl?: typeof fetch): ResultsZA {
  return new ResultsZA({ apiKey, baseUrl: BASE_URL, ...(fetchImpl ? { fetchImpl } : {}) });
}
