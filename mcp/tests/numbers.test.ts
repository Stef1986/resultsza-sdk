import { describe, expect, it } from "vitest";
import { connect, fakeClient, noNetworkClient } from "./helpers";

describe("number tools", () => {
  it("generate_routes_game_and_lines", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "generate_lottery_numbers", arguments: { game: "Lotto", lines: 3 } });
    expect(client.generateRandomNumbers).toHaveBeenCalledWith({ game: "Lotto", lines: 3 });
  });

  it("generate_defaults_to_one_line", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "generate_lottery_numbers", arguments: { game: "Powerball" } });
    expect(client.generateRandomNumbers).toHaveBeenCalledWith({ game: "Powerball", lines: 1 });
  });

  it("lucky_routes_game_and_text", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    await mcp.callTool({ name: "lucky_numbers_from_text", arguments: { game: "Lotto", text: "John Doe" } });
    expect(client.textToLuckyNumbers).toHaveBeenCalledWith({ game: "Lotto", text: "John Doe" });
  });

  it("statistics_routes_each_kind", async () => {
    for (const [kind, method] of [
      ["hot_cold", "getHotColdNumbers"],
      ["frequencies", "getNumberFrequencies"],
      ["pairs", "getNumberPairs"],
    ] as const) {
      const client = fakeClient();
      const mcp = await connect(client);
      await mcp.callTool({ name: "get_number_statistics", arguments: { kind, product: "Lotto" } });
      expect((client as any)[method]).toHaveBeenCalledWith({ product: "Lotto" });
    }
  });

  it("lines_501_rejected_without_api_call", async () => {
    const { client, fetch } = noNetworkClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({ name: "generate_lottery_numbers", arguments: { game: "Lotto", lines: 501 } });
    expect(res.isError).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caps_reject_bad_input_without_api_call", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const bad: Array<[string, Record<string, unknown>]> = [
      ["lucky_numbers_from_text", { game: "Lotto", text: "x".repeat(201) }],
      ["lucky_numbers_from_text", { game: "Lotto", text: "" }],
      ["get_number_statistics", { kind: "everything", product: "Lotto" }],
      ["get_number_statistics", { kind: "pairs", product: "P".repeat(61) }],
      ["generate_lottery_numbers", { game: "G".repeat(61) }],
      ["generate_lottery_numbers", { game: "Lotto", lines: 0 }],
      ["generate_lottery_numbers", { game: "Lotto", extra: true }],
    ];
    for (const [name, args] of bad) {
      const res: any = await mcp.callTool({ name, arguments: args });
      expect(res.isError, `${name} ${JSON.stringify(args)}`).toBe(true);
    }
    for (const m of ["generateRandomNumbers", "textToLuckyNumbers", "getNumberPairs", "getHotColdNumbers"]) {
      expect((client as any)[m]).not.toHaveBeenCalled();
    }
  });
});
