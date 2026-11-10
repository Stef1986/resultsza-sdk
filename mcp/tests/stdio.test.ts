import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { VERSION } from "../src/version";

const EXPECTED_TOOLS = [
  "check_balance",
  "get_lottery_results",
  "check_lottery_numbers",
  "bulk_check_lottery_numbers",
  "get_horse_racing_meetings",
  "get_horse_racing_card",
  "get_horse_race",
  "generate_lottery_numbers",
  "lucky_numbers_from_text",
  "get_number_statistics",
];


describe("stdio", () => {
  it("spawns_built_server_and_lists_10_tools", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/index.js"],
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...getDefaultEnvironment(), RESULTSZA_API_KEY: "test" },
      stderr: "pipe",
    });
    const client = new Client({ name: "stdio-test", version: "1.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
      expect(client.getServerVersion()?.version).toBe(VERSION);
    } finally {
      await client.close();
    }
  });

  it("versions_match_everywhere", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const server = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
    expect(pkg.version).toBe(VERSION);
    expect(server.version).toBe(VERSION);
    expect(server.packages[0].version).toBe(VERSION);
    expect(server.name).toBe(pkg.mcpName);
    expect(pkg.mcpName).toBe("za.co.resultsza/mcp");
  });
});
