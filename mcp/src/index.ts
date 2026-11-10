import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { buildClient } from "./client";
import { readApiKey } from "./config";
import { createServer } from "./server";
import { VERSION } from "./version";

async function main(): Promise<void> {
  const apiKey = readApiKey(process.env);
  const client = apiKey ? buildClient(apiKey) : null;
  const server = createServer({ client, version: VERSION, apiKey: apiKey ?? undefined });
  await server.connect(new StdioServerTransport());
  // stdout carries only the MCP protocol; status goes to stderr.
  process.stderr.write(
    apiKey ? "ResultsZA MCP server running.\n" : "ResultsZA MCP server running without RESULTSZA_API_KEY.\n",
  );
}

main().catch((err) => {
  process.stderr.write(`ResultsZA MCP server failed to start: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
