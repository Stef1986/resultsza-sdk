import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import type { ToolContext } from "../server";
import { defineTool } from "./define";

function balanceSummary(data: any): string | null {
  if (!data || typeof data !== "object") return null;
  if (data.tier && data.used !== undefined && data.monthly_limit !== undefined) {
    return `Plan: ${data.tier}, used ${data.used} of ${data.monthly_limit} calls this month.`;
  }
  if (data.subscription_status === "none") return "No active subscription on this key.";
  return null;
}

export function registerAccountTools(server: McpServer, ctx: ToolContext): void {
  defineTool(
    server,
    ctx,
    "check_balance",
    {
      title: "Check ResultsZA balance",
      description:
        "Show the user's ResultsZA plan, calls used this month and calls left, and the subscription " +
        "end date. Free: does not use any API calls.",
      inputSchema: z.strictObject({}),
    },
    (client) => client.checkBalance(),
    balanceSummary,
  );
}
