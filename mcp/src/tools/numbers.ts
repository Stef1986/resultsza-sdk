import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ToolContext } from "../server";
import { COST_ONE_CALL, defineTool } from "./define";

const game = z
  .string()
  .min(1)
  .max(60)
  .describe('Game name as the API uses it, e.g. "Lotto", "Powerball", "Daily Lotto", "EuroMillions", "UK49s Lunchtime".');

export function registerNumberTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    "generate_lottery_numbers",
    {
      title: "Generate lottery numbers",
      description:
        "Random lines for a game using its correct number ranges. Uses 1 API call from your ResultsZA " +
        "plan (regardless of the number of lines). Unknown games are rejected without using a call.",
      inputSchema: z.strictObject({
        game,
        lines: z.number().int().min(1).max(500).default(1).describe("How many lines, 1 to 500 (default 1)."),
      }),
    },
    (c, a) => c.generateRandomNumbers({ game: a.game, lines: a.lines }),
  );
  defineTool(
    server,
    ctx,
    "lucky_numbers_from_text",
    {
      title: "Lucky numbers from text",
      description:
        "Personalised numbers for a game derived from a name, date or phrase (the same text always " +
        "gives the same numbers). For fun only. " +
        COST_ONE_CALL,
      inputSchema: z.strictObject({
        game,
        text: z.string().min(1).max(200).describe("A name, date or phrase."),
      }),
    },
    (c, a) => c.textToLuckyNumbers({ game: a.game, text: a.text }),
  );
  defineTool(
    server,
    ctx,
    "get_number_statistics",
    {
      title: "Get number statistics",
      description:
        "Historical number statistics for a game: hot and cold numbers, how often each number was " +
        'drawn, or the most common pairs. Products include the South African games, "UK49s" (all ' +
        'four draws combined), "EuroMillions", "US Powerball", "Kenya Lotto" and "Gosloto 6/45". ' +
        "Unknown products are rejected without using a call. " +
        COST_ONE_CALL,
      inputSchema: z.strictObject({
        kind: z.enum(["hot_cold", "frequencies", "pairs"]).describe("Which statistics."),
        product: z.string().min(1).max(60).describe('Game, e.g. "Lotto" or "UK49s".'),
      }),
    },
    (c, a) => {
      if (a.kind === "hot_cold") return c.getHotColdNumbers({ product: a.product });
      if (a.kind === "frequencies") return c.getNumberFrequencies({ product: a.product });
      return c.getNumberPairs({ product: a.product });
    },
  );
}
