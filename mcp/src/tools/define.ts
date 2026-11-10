import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import type * as z from "zod/v4";
import { runTool } from "../run";
import type { ResultsZALike, ToolContext } from "../server";

/** Read-only, talks to resultsza.co.za: the same hints for every tool. */
export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: true } as const;

export const COST_ONE_CALL = "Uses 1 API call from your ResultsZA plan.";

/**
 * Register one tool: strict zod input (unknown properties rejected), read-only
 * hints, and exactly one SDK call through runTool (no retries).
 */
export function defineTool<S extends z.ZodObject>(
  server: McpServer,
  ctx: ToolContext,
  name: string,
  meta: { title: string; description: string; inputSchema: S },
  call: (client: ResultsZALike, args: z.infer<S>) => Promise<unknown>,
  summarize?: (data: any, args: z.infer<S>) => string | null,
): void {
  server.registerTool(
    name,
    {
      title: meta.title,
      description: meta.description,
      inputSchema: meta.inputSchema as z.ZodObject<z.ZodRawShape>,
      annotations: READ_ONLY,
    },
    // The SDK has already validated `raw` against the strict schema above.
    async (raw: unknown): Promise<CallToolResult> => {
      const args = raw as z.infer<S>;
      return runTool(
        ctx.client,
        (client) => call(client, args),
        summarize ? (data) => summarize(data, args) : undefined,
        ctx.apiKey,
      );
    },
  );
}
