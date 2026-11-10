import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ToolContext } from "../server";
import { COST_ONE_CALL, defineTool } from "./define";

const date = z.string().max(10);
const venue = z.string().min(1).max(60).describe('Racecourse as named by get_horse_racing_meetings, e.g. "Greyville".');

export function registerRacingTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    "get_horse_racing_meetings",
    {
      title: "List horse racing meetings",
      description:
        "South African horse racing meetings (date, venue, number of races) in a date range of at " +
        "most 7 days. Defaults to the last 7 days. Use it to find the venue name for the other " +
        "racing tools. " +
        COST_ONE_CALL,
      inputSchema: z.strictObject({
        from_date: date.optional().describe("Start date as YYYY-MM-DD."),
        to_date: date.optional().describe("End date as YYYY-MM-DD (at most 7 days after from_date)."),
      }),
    },
    (c, a) => c.getHorseRacingMeetings({ fromDate: a.from_date, toDate: a.to_date }),
  );
  defineTool(
    server,
    ctx,
    "get_horse_racing_card",
    {
      title: "Get a horse racing card",
      description:
        "All races at one South African meeting with the top three finishers and tote dividends. " +
        COST_ONE_CALL,
      inputSchema: z.strictObject({ date: date.describe("Meeting date as YYYY-MM-DD."), venue }),
    },
    (c, a) => c.getHorseRacingResults({ date: a.date, venue: a.venue }),
  );
  defineTool(
    server,
    ctx,
    "get_horse_race",
    {
      title: "Get one horse race",
      description: "The full runner table for one race at a South African meeting. " + COST_ONE_CALL,
      inputSchema: z.strictObject({
        date: date.describe("Meeting date as YYYY-MM-DD."),
        venue,
        race_no: z.number().int().min(1).max(30).describe("Race number at that meeting."),
      }),
    },
    (c, a) => c.getHorseRacingRace({ date: a.date, venue: a.venue, raceNo: a.race_no }),
  );
}
