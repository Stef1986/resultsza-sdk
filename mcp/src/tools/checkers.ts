import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ToolContext } from "../server";
import { defineTool } from "./define";

export const CHECKER_GAMES = [
  "Daily Lotto",
  "Lotto",
  "Lotto Plus 1",
  "Lotto 5 Max",
  "Powerball",
  "Powerball Xtra",
  "Daily Lotto Plus",
  "Lotto Plus 2",
  "Powerball Plus",
] as const;

const number = z.number().int().min(0).max(99);
const line = z.array(number).min(1).max(10);

function schemaFor(maxLines: number) {
  return z.strictObject({
    game: z
      .enum(CHECKER_GAMES)
      .describe("South African game. Daily Lotto Plus, Lotto Plus 2 and Powerball Plus only for draws before 2026-06-01."),
    date: z.string().max(10).describe("Draw date as YYYY-MM-DD."),
    lines: z
      .union([line, z.array(line).min(1).max(maxLines)])
      .describe(
        "One line (array of numbers) or several lines (array of arrays). Lotto games: 6 numbers. " +
          "Powerball games: 5 main numbers then the Powerball as the 6th. Daily Lotto: 5 numbers.",
      ),
  });
}

const RESULT_NOTE = "Returns matches and the prize division per line for that draw.";

export function registerCheckerTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    "check_lottery_numbers",
    {
      title: "Check lottery numbers",
      description:
        "Check up to 10 lines of numbers against one South African National Lottery draw. " +
        RESULT_NOTE +
        " Uses 1 API call per request (up to 10 lines).",
      inputSchema: schemaFor(10),
    },
    (c, a) => c.checkPlayedNumbers({ game: a.game, date: a.date, playedNumbers: a.lines }),
  );
  defineTool(
    server,
    ctx,
    "bulk_check_lottery_numbers",
    {
      title: "Bulk check lottery numbers",
      description:
        "Check up to 500 lines against one South African National Lottery draw. " +
        RESULT_NOTE +
        " Uses 1 API call PER LINE (up to 500). Only use this when the user explicitly has more " +
        "than 10 lines; otherwise use check_lottery_numbers, which costs 1 call for up to 10 lines.",
      inputSchema: schemaFor(500),
    },
    (c, a) => c.bulkCheckNumbers({ game: a.game, date: a.date, playedNumbers: a.lines }),
  );
}
