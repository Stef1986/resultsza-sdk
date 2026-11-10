import { vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { ResultsZA } from "resultsza-sdk";
import { createServer, type ResultsZALike } from "../src/server";

/** Every client method a tool may call, as a vi.fn(); override per test. */
export const CLIENT_METHODS = [
  "checkBalance",
  "getDailyLottoResults",
  "getLottoResults",
  "getLottoPlus1Results",
  "getLotto5MaxResults",
  "getSaPowerballResults",
  "getPowerballXtraResults",
  "getUk49sResults",
  "getEuromillionsResults",
  "getIrishLottoResults",
  "getUsPowerballResults",
  "getMegamillionsResults",
  "getKenyaLottoResults",
  "getNigeriaLottoResults",
  "getGhanaLottoResults",
  "getGosloto645Results",
  "getGosloto749Results",
  "getGosloto536Results",
  "checkPlayedNumbers",
  "bulkCheckNumbers",
  "getHorseRacingMeetings",
  "getHorseRacingResults",
  "getHorseRacingRace",
  "generateRandomNumbers",
  "textToLuckyNumbers",
  "getHotColdNumbers",
  "getNumberFrequencies",
  "getNumberPairs",
] as const;

export type FakeClient = { [K in (typeof CLIENT_METHODS)[number]]: ReturnType<typeof vi.fn> };

export function fakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const c = {} as FakeClient;
  for (const m of CLIENT_METHODS) c[m] = vi.fn().mockResolvedValue({ status: "success" });
  return Object.assign(c, overrides);
}

/**
 * A real SDK client whose fetch fails the test if it is ever called: proves
 * that invalid input is rejected before any network request.
 */
export function noNetworkClient(apiKey = "test-key"): { client: ResultsZA; fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(async () => {
    throw new Error("network must not be called");
  });
  return { client: new ResultsZA({ apiKey, fetchImpl: fetch as unknown as typeof globalThis.fetch }), fetch };
}

/** Valid arguments for every tool, so security tests can call them all. */
export const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  check_balance: {},
  get_lottery_results: { game: "Lotto" },
};

export async function connect(client: ResultsZALike | FakeClient | null, apiKey?: string): Promise<Client> {
  const server = createServer({ client: client as ResultsZALike | null, version: "0.0.0-test", apiKey });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "test-harness", version: "1.0.0" });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  return mcp;
}

/** All text content of a tool result joined, for "does not contain" checks. */
export function resultText(result: any): string {
  return (result?.content ?? []).map((c: any) => (c.type === "text" ? c.text : "")).join("\n");
}
