import { vi } from "vitest";

import { ResultsZA } from "../src/index";
import type { ClientOptions } from "../src/client";

export const BASE = "https://resultsza.co.za";
export const API_KEY = "test-key-123";

export interface RecordedCall {
  url: string;
  method: string;
  body: string | undefined;
}

/** A fake `fetch` that records requests and returns a single canned JSON body. */
export function mockFetch(json: unknown, status = 200) {
  const calls: RecordedCall[] = [];
  const impl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: input.toString(),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return new Response(JSON.stringify(json), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

export function makeClient(fetchImpl: typeof fetch, extra: Partial<ClientOptions> = {}) {
  return new ResultsZA({ apiKey: API_KEY, fetchImpl, ...extra });
}

export function lastUrl(calls: RecordedCall[]): URL {
  return new URL(calls[calls.length - 1]!.url);
}
