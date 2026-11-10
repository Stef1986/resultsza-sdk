import { McpServer } from "@modelcontextprotocol/server";
import type { ResultsZA } from "resultsza-sdk";
import { registerAccountTools } from "./tools/account";
import { registerResultsTools } from "./tools/results";

/** The SDK methods the tools call (lets tests pass a fake client). */
export type ResultsZALike = Pick<
  ResultsZA,
  | "checkBalance"
  | "getDailyLottoResults"
  | "getLottoResults"
  | "getLottoPlus1Results"
  | "getLotto5MaxResults"
  | "getSaPowerballResults"
  | "getPowerballXtraResults"
  | "getUk49sResults"
  | "getEuromillionsResults"
  | "getIrishLottoResults"
  | "getUsPowerballResults"
  | "getMegamillionsResults"
  | "getKenyaLottoResults"
  | "getNigeriaLottoResults"
  | "getGhanaLottoResults"
  | "getGosloto645Results"
  | "getGosloto749Results"
  | "getGosloto536Results"
  | "checkPlayedNumbers"
  | "bulkCheckNumbers"
  | "getHorseRacingMeetings"
  | "getHorseRacingResults"
  | "getHorseRacingRace"
  | "generateRandomNumbers"
  | "textToLuckyNumbers"
  | "getHotColdNumbers"
  | "getNumberFrequencies"
  | "getNumberPairs"
>;

/** What every tool registration needs: the client (null = no key) and the key to redact. */
export type ToolContext = { client: ResultsZALike | null; apiKey?: string };

export type CreateServerOptions = { client: ResultsZALike | null; version: string; apiKey?: string };

export function createServer(opts: CreateServerOptions): McpServer {
  const server = new McpServer(
    { name: "resultsza", title: "ResultsZA", version: opts.version },
    {
      instructions:
        "Official ResultsZA tools for South African and international lottery results, number " +
        "checking, number statistics and South African horse racing. Every data tool uses API " +
        "calls from the user's ResultsZA plan (stated in each description); check_balance is free. " +
        "Prefer one well-chosen call over many, and never loop over dates or games unless the user asks.",
    },
  );
  const ctx: ToolContext = { client: opts.client, apiKey: opts.apiKey };
  registerAccountTools(server, ctx);
  registerResultsTools(server, ctx);
  return server;
}
