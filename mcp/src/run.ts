import { RateLimitError, ResultsZAError } from "resultsza-sdk";
import type { ResultsZALike } from "./server";

export const MISSING_KEY_MESSAGE =
  "ResultsZA API key not set. Add RESULTSZA_API_KEY to this MCP server's environment. " +
  "Get a key at https://resultsza.co.za/signup (create an account, then generate the key in My Dashboard).";

type TextContent = { type: "text"; text: string };
export type ToolResult = { [x: string]: unknown; content: TextContent[]; isError?: boolean };

/** Remove the key (and any api_key=... value) from text before it leaves the server. */
export function redact(text: string, apiKey?: string): string {
  let out = text.replace(/api_key=[^&\s"'<>]+/gi, "api_key=***");
  if (apiKey) out = out.split(apiKey).join("***");
  return out;
}

function errorText(err: unknown): string {
  if (err instanceof ResultsZAError) {
    let msg = err.message;
    if (err instanceof RateLimitError && err.retryAfter !== undefined) {
      msg += ` Retry after ${err.retryAfter} seconds.`;
    }
    return msg;
  }
  const detail = err instanceof Error ? err.message : String(err);
  return `Could not reach ResultsZA: ${detail}`;
}

/**
 * Run one tool call: exactly one SDK call, no retries. Returns the API JSON
 * (preceded by a short summary when `summarize` gives one) or a tool error.
 */
export async function runTool(
  client: ResultsZALike | null,
  call: (c: ResultsZALike) => Promise<unknown>,
  summarize?: (data: any) => string | null,
  apiKey?: string,
): Promise<ToolResult> {
  if (client === null) {
    return { content: [{ type: "text", text: MISSING_KEY_MESSAGE }], isError: true };
  }
  try {
    const data = await call(client);
    const content: TextContent[] = [];
    let summary: string | null = null;
    try {
      summary = summarize ? summarize(data) : null;
    } catch {
      summary = null;
    }
    if (summary) content.push({ type: "text", text: redact(summary, apiKey) });
    content.push({ type: "text", text: redact(JSON.stringify(data, null, 2) ?? "null", apiKey) });
    return { content };
  } catch (err) {
    return { content: [{ type: "text", text: redact(errorText(err), apiKey) }], isError: true };
  }
}
