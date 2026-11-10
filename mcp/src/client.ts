import { ResultsZA } from "resultsza-sdk";

/**
 * The only host this server ever talks to. Deliberately not configurable
 * (no env var, argument or setting), so a prompt-injected tool call cannot
 * send the user's key anywhere else.
 */
export const BASE_URL = "https://resultsza.co.za";

/**
 * Every request refuses redirects: the key travels in the query string, and a
 * redirect (for example from a proxy misconfiguration) would otherwise carry
 * it to whatever host the redirect points at.
 */
export function noRedirectFetch(fetchImpl: typeof fetch = globalThis.fetch): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    fetchImpl(input, { ...init, redirect: "error" })) as typeof fetch;
}

export function buildClient(apiKey: string, fetchImpl?: typeof fetch): ResultsZA {
  return new ResultsZA({ apiKey, baseUrl: BASE_URL, fetchImpl: noRedirectFetch(fetchImpl) });
}
