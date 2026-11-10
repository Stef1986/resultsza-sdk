import { describe, expect, it, vi } from "vitest";
import { connect, fakeClient, noNetworkClient, resultText } from "./helpers";

const ROUTES: Array<[Record<string, unknown>, string, Record<string, unknown>]> = [
  [{ game: "Daily Lotto" }, "getDailyLottoResults", { date: undefined }],
  [{ game: "Lotto", date: "2026-06-03" }, "getLottoResults", { date: "2026-06-03" }],
  [{ game: "Lotto Plus 1" }, "getLottoPlus1Results", { date: undefined }],
  [{ game: "Lotto 5 Max" }, "getLotto5MaxResults", { date: undefined }],
  [{ game: "Powerball" }, "getSaPowerballResults", { date: undefined }],
  [{ game: "Powerball Xtra" }, "getPowerballXtraResults", { date: undefined }],
  [{ game: "UK49s", uk49s_draw: "Lunchtime" }, "getUk49sResults", { game: "UK49s Lunchtime", date: undefined }],
  [{ game: "EuroMillions" }, "getEuromillionsResults", { date: undefined }],
  [{ game: "Irish Lotto" }, "getIrishLottoResults", { date: undefined }],
  [{ game: "US Powerball" }, "getUsPowerballResults", { date: undefined }],
  [{ game: "Mega Millions" }, "getMegamillionsResults", { date: undefined }],
  [{ game: "Kenya Lotto", kenya_type: "jackpot" }, "getKenyaLottoResults", { date: undefined, drawType: "jackpot" }],
  [{ game: "Nigeria Lotto", draw_name: "PREMIER BINGO" }, "getNigeriaLottoResults", { game: "PREMIER BINGO", date: undefined }],
  [{ game: "Ghana Lotto", draw_name: "Ghana Lucky Tuesday" }, "getGhanaLottoResults", { game: "Ghana Lucky Tuesday", date: undefined }],
  [{ game: "Gosloto 6/45", draw_id: "12345" }, "getGosloto645Results", { date: undefined, drawId: "12345" }],
  [{ game: "Gosloto 7/49" }, "getGosloto749Results", { date: undefined, drawId: undefined }],
  [{ game: "Gosloto 5/36" }, "getGosloto536Results", { date: undefined, drawId: undefined }],
];

describe("get_lottery_results", () => {
  it("routes_each_game_to_its_sdk_method", async () => {
    for (const [args, method, expected] of ROUTES) {
      const client = fakeClient();
      const mcp = await connect(client);
      const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: args });
      expect(res.isError, `${method}: ${resultText(res)}`).toBeFalsy();
      expect((client as any)[method]).toHaveBeenCalledTimes(1);
      expect((client as any)[method]).toHaveBeenCalledWith(expected);
    }
  });

  it("describes_cost_and_is_read_only", async () => {
    const mcp = await connect(fakeClient());
    const { tools } = await mcp.listTools();
    const tool = tools.find((t) => t.name === "get_lottery_results")!;
    expect(tool.description).toContain("Uses 1 API call");
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("uk49s_requires_draw", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: { game: "UK49s" } });
    expect(res.isError).toBe(true);
    expect(resultText(res)).toContain("Brunchtime");
    expect(client.getUk49sResults).not.toHaveBeenCalled();
  });

  it("rejects_non_iso_date_without_calling_api", async () => {
    const { client, fetch } = noNetworkClient();
    const mcp = await connect(client);
    for (const date of ["2026/11/08", "yesterday"]) {
      const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: { game: "Lotto", date } });
      expect(res.isError, date).toBe(true);
      expect(resultText(res)).toContain("YYYY-MM-DD");
    }
    const impossible: any = await mcp.callTool({ name: "get_lottery_results", arguments: { game: "Lotto", date: "2026-13-01" } });
    expect(impossible.isError).toBe(true);
    expect(resultText(impossible)).toContain("not a real calendar date");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("summary_line_for_lotto", async () => {
    const data = {
      status: "success",
      results: [{ game_type: "Lotto", draw_date: "2026-06-03T21:00:00Z", winning_numbers: [5, 8, 19, 30, 44, 46], bonus_ball: 13 }],
    };
    const mcp = await connect(fakeClient({ getLottoResults: vi.fn().mockResolvedValue(data) }));
    const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: { game: "Lotto" } });
    expect(res.content[0].text).toContain("5 8 19 30 44 46 + 13");
    expect(res.content[0].text).toContain("2026-06-03");
  });

  it("caps_and_unknown_fields_rejected_without_api_call", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const bad = [
      { game: "Lotto", baseUrl: "https://evil.example" },
      { game: "Nigeria Lotto", draw_name: "X".repeat(61) },
      { game: "Gosloto 6/45", draw_id: "1".repeat(21) },
      { game: "Not A Game" },
    ];
    for (const args of bad) {
      const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: args });
      expect(res.isError, JSON.stringify(args)).toBe(true);
    }
    for (const m of Object.keys(client)) expect((client as any)[m]).not.toHaveBeenCalled();
  });
});
