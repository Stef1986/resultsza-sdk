import type { McpServer } from "@modelcontextprotocol/server";
import { ValidationError } from "resultsza-sdk";
import * as z from "zod/v4";
import type { ResultsZALike, ToolContext } from "../server";
import { COST_ONE_CALL, defineTool } from "./define";

export const RESULT_GAMES = [
  "Daily Lotto",
  "Lotto",
  "Lotto Plus 1",
  "Lotto 5 Max",
  "Powerball",
  "Powerball Xtra",
  "UK49s",
  "EuroMillions",
  "Irish Lotto",
  "US Powerball",
  "Mega Millions",
  "Kenya Lotto",
  "Nigeria Lotto",
  "Ghana Lotto",
  "Gosloto 6/45",
  "Gosloto 7/49",
  "Gosloto 5/36",
] as const;

const UK49S_DRAWS = ["Brunchtime", "Lunchtime", "Drivetime", "Teatime"] as const;

const schema = z.strictObject({
  game: z.enum(RESULT_GAMES).describe("The lottery game."),
  date: z
    .string()
    .max(10)
    .optional()
    .describe("Draw date as YYYY-MM-DD. Omit for the latest draw."),
  uk49s_draw: z.enum(UK49S_DRAWS).optional().describe("Required when game is UK49s."),
  kenya_type: z.enum(["daily", "jackpot"]).optional().describe("Kenya only: daily draws or the Mega Jackpot."),
  draw_name: z
    .string()
    .max(60)
    .optional()
    .describe('Nigeria or Ghana only: one draw, e.g. "PREMIER BINGO" or "Ghana Lucky Tuesday". Omit for all.'),
  draw_id: z.string().max(20).optional().describe("Gosloto only: one draw by its number (ignored when date is given)."),
});

type Args = z.infer<typeof schema>;

function route(c: ResultsZALike, a: Args): Promise<unknown> {
  const date = a.date;
  switch (a.game) {
    case "Daily Lotto":
      return c.getDailyLottoResults({ date });
    case "Lotto":
      return c.getLottoResults({ date });
    case "Lotto Plus 1":
      return c.getLottoPlus1Results({ date });
    case "Lotto 5 Max":
      return c.getLotto5MaxResults({ date });
    case "Powerball":
      return c.getSaPowerballResults({ date });
    case "Powerball Xtra":
      return c.getPowerballXtraResults({ date });
    case "UK49s":
      if (!a.uk49s_draw) {
        throw new ValidationError("uk49s_draw is required for UK49s: Brunchtime, Lunchtime, Drivetime or Teatime.");
      }
      return c.getUk49sResults({ game: `UK49s ${a.uk49s_draw}`, date });
    case "EuroMillions":
      return c.getEuromillionsResults({ date });
    case "Irish Lotto":
      return c.getIrishLottoResults({ date });
    case "US Powerball":
      return c.getUsPowerballResults({ date });
    case "Mega Millions":
      return c.getMegamillionsResults({ date });
    case "Kenya Lotto":
      return c.getKenyaLottoResults({ date, drawType: a.kenya_type });
    case "Nigeria Lotto":
      return c.getNigeriaLottoResults({ game: a.draw_name, date });
    case "Ghana Lotto":
      return c.getGhanaLottoResults({ game: a.draw_name, date });
    case "Gosloto 6/45":
      return c.getGosloto645Results({ date, drawId: a.draw_id });
    case "Gosloto 7/49":
      return c.getGosloto749Results({ date, drawId: a.draw_id });
    case "Gosloto 5/36":
      return c.getGosloto536Results({ date, drawId: a.draw_id });
  }
}

function summary(data: any, a: Args): string | null {
  const first = Array.isArray(data?.results) ? data.results[0] : null;
  if (!first || first.winning_numbers === undefined) return null;
  const nums = Array.isArray(first.winning_numbers) ? first.winning_numbers.join(" ") : String(first.winning_numbers);
  const when = String(first.draw_date ?? first.date ?? "").slice(0, 10);
  const bonus = first.bonus_ball !== undefined && first.bonus_ball !== null ? ` + ${first.bonus_ball}` : "";
  return `${a.game}${when ? `, ${when}` : ""}: ${nums}${bonus}`;
}

export function registerResultsTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    "get_lottery_results",
    {
      title: "Get lottery results",
      description:
        "Official draw results for one game: South African National Lottery games (with prize " +
        "divisions, winners and jackpot), UK 49's, EuroMillions, Irish Lotto, US Powerball, Mega " +
        "Millions, Kenya, Nigeria, Ghana and Gosloto. Omit date for the latest draw. Gosloto and " +
        "Kenya with a date return every draw that day. " +
        COST_ONE_CALL,
      inputSchema: schema,
    },
    route,
    summary,
  );
}
