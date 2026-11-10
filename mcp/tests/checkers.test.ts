import { describe, expect, it } from "vitest";
import { connect, fakeClient, noNetworkClient } from "./helpers";

const LINE = [5, 20, 21, 36, 1, 13];

describe("number checkers", () => {
  it("check_maps_lines_to_playedNumbers", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({
      name: "check_lottery_numbers",
      arguments: { game: "Lotto", date: "2026-08-05", lines: [LINE, LINE] },
    });
    expect(res.isError).toBeFalsy();
    expect(client.checkPlayedNumbers).toHaveBeenCalledWith({ game: "Lotto", date: "2026-08-05", playedNumbers: [LINE, LINE] });
  });

  it("check_accepts_a_single_flat_line", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "check_lottery_numbers", arguments: { game: "Lotto", date: "2026-08-05", lines: LINE } });
    expect(client.checkPlayedNumbers).toHaveBeenCalledWith({ game: "Lotto", date: "2026-08-05", playedNumbers: LINE });
  });

  it("bulk_maps_lines_to_playedNumbers", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const lines = Array.from({ length: 12 }, () => LINE);
    const res: any = await mcp.callTool({
      name: "bulk_check_lottery_numbers",
      arguments: { game: "Powerball", date: "2026-08-05", lines },
    });
    expect(res.isError).toBeFalsy();
    expect(client.bulkCheckNumbers).toHaveBeenCalledWith({ game: "Powerball", date: "2026-08-05", playedNumbers: lines });
  });

  it("check_rejects_11_lines_without_api_call", async () => {
    const { client, fetch } = noNetworkClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({
      name: "check_lottery_numbers",
      arguments: { game: "Lotto", date: "2026-08-05", lines: Array.from({ length: 11 }, () => LINE) },
    });
    expect(res.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bulk_description_warns_per_line_cost", async () => {
    const mcp = await connect(fakeClient());
    const { tools } = await mcp.listTools();
    const bulk = tools.find((t) => t.name === "bulk_check_lottery_numbers")!;
    expect(bulk.description).toContain("PER LINE");
    expect(bulk.description).toContain("check_lottery_numbers");
    const check = tools.find((t) => t.name === "check_lottery_numbers")!;
    expect(check.description).toContain("Uses 1 API call per request");
  });

  it("caps_reject_oversized_input_without_api_call", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const bad = [
      { game: "Lotto", date: "2026-08-05", lines: [Array.from({ length: 11 }, (_, i) => i + 1)] },
      { game: "Lotto", date: "2026-08-05", lines: [[1, 2, 3, 4, 5, 1000]] },
      { game: "Lotto", date: "2026-08-05", lines: [[1.5, 2, 3, 4, 5, 6]] },
      { game: "Lotto", date: "2026-08-05", lines: [LINE], extra: true },
      { game: "Lotto", lines: [LINE] },
    ];
    for (const args of bad) {
      const res: any = await mcp.callTool({ name: "check_lottery_numbers", arguments: args });
      expect(res.isError, JSON.stringify(args)).toBe(true);
    }
    const tooMany: any = await mcp.callTool({
      name: "bulk_check_lottery_numbers",
      arguments: { game: "Lotto", date: "2026-08-05", lines: Array.from({ length: 501 }, () => LINE) },
    });
    expect(tooMany.isError).toBe(true);
    expect(client.checkPlayedNumbers).not.toHaveBeenCalled();
    expect(client.bulkCheckNumbers).not.toHaveBeenCalled();
  });
});
