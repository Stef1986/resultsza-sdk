import { describe, expect, it, vi } from "vitest";
import { connect, fakeClient, noNetworkClient } from "./helpers";

describe("horse racing tools", () => {
  it("meetings_routes_dates", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "get_horse_racing_meetings", arguments: { from_date: "2026-11-01", to_date: "2026-11-07" } });
    expect(client.getHorseRacingMeetings).toHaveBeenCalledWith({ fromDate: "2026-11-01", toDate: "2026-11-07" });
  });

  it("card_routes_date_and_venue", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "get_horse_racing_card", arguments: { date: "2026-11-01", venue: "Greyville" } });
    expect(client.getHorseRacingResults).toHaveBeenCalledWith({ date: "2026-11-01", venue: "Greyville" });
  });

  it("race_routes_race_number", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "get_horse_race", arguments: { date: "2026-11-01", venue: "Greyville", race_no: 3 } });
    expect(client.getHorseRacingRace).toHaveBeenCalledWith({ date: "2026-11-01", venue: "Greyville", raceNo: 3 });
  });

  it("race_output_is_the_api_json_unmodified", async () => {
    const data = { status: "success", race_no: 3, grade: "Grade 1", runners: [{ horse_name: "Example", sp_decimal: 7 }] };
    const mcp = await connect(fakeClient({ getHorseRacingRace: vi.fn().mockResolvedValue(data) }));
    const res: any = await mcp.callTool({ name: "get_horse_race", arguments: { date: "2026-11-01", venue: "Greyville", race_no: 3 } });
    expect(JSON.parse(res.content[res.content.length - 1].text)).toEqual(data);
  });

  it("meetings_span_over_7_days_is_rejected_without_api_call", async () => {
    const { client, fetch } = noNetworkClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({
      name: "get_horse_racing_meetings",
      arguments: { from_date: "2026-10-01", to_date: "2026-10-20" },
    });
    expect(res.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps_reject_bad_input_without_api_call", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const bad: Array<[string, Record<string, unknown>]> = [
      ["get_horse_racing_card", { date: "2026-11-01", venue: "V".repeat(61) }],
      ["get_horse_racing_card", { date: "2026-11-01" }],
      ["get_horse_race", { date: "2026-11-01", venue: "Greyville", race_no: 0 }],
      ["get_horse_race", { date: "2026-11-01", venue: "Greyville", race_no: 2.5 }],
      ["get_horse_racing_meetings", { from_date: "2026-11-01", extra: 1 }],
    ];
    for (const [name, args] of bad) {
      const res: any = await mcp.callTool({ name, arguments: args });
      expect(res.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
    }
    expect(client.getHorseRacingResults).not.toHaveBeenCalled();
    expect(client.getHorseRacingRace).not.toHaveBeenCalled();
    expect(client.getHorseRacingMeetings).not.toHaveBeenCalled();
  });
});
