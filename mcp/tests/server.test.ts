import { describe, expect, it, vi } from "vitest";
import { QuotaExceededError, RateLimitError, SubscriptionExpiredError } from "resultsza-sdk";
import { readApiKey } from "../src/config";
import { buildClient } from "../src/client";
import { SAMPLE_ARGS, connect, fakeClient, resultText } from "./helpers";

describe("server basics", () => {
  it("lists_check_balance_with_read_only_annotation", async () => {
    const mcp = await connect(fakeClient());
    const { tools } = await mcp.listTools();
    const tool = tools.find((t) => t.name === "check_balance");
    expect(tool).toBeDefined();
    expect(tool!.annotations?.readOnlyHint).toBe(true);
    expect(tool!.annotations?.openWorldHint).toBe(true);
    expect(tool!.description).toContain("Free");
  });

  it("trims_key_whitespace", () => {
    expect(readApiKey({ RESULTSZA_API_KEY: "  abc123\n" })).toBe("abc123");
    expect(readApiKey({})).toBeNull();
    expect(readApiKey({ RESULTSZA_API_KEY: "  " })).toBeNull();
  });

  it("missing_key_returns_setup_message", async () => {
    const mcp = await connect(null);
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    const text = resultText(res);
    expect(text).toContain("RESULTSZA_API_KEY");
    expect(text).toContain("https://resultsza.co.za/signup");
  });

  it("check_balance_returns_summary_and_json", async () => {
    const data = { status: "success", tier: "basic", used: 120, monthly_limit: 1500 };
    const mcp = await connect(fakeClient({ checkBalance: vi.fn().mockResolvedValue(data) }));
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("120");
    expect(JSON.parse(res.content[1].text)).toEqual(data);
  });
});

describe("balance summary", () => {
  it("unlimited_plan_summary_reads_naturally", async () => {
    const data = { status: "success", tier: "unlimited", used: 450, monthly_limit: "Unlimited (Fair Use)", is_unlimited: true };
    const mcp = await connect(fakeClient({ checkBalance: vi.fn().mockResolvedValue(data) }));
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.content[0].text).toBe("Plan: unlimited, used 450 calls this month (no monthly limit, fair use applies).");
  });
});

describe("errors", () => {
  it("rate_limit_error_reports_retry_and_does_not_retry", async () => {
    const err = new RateLimitError("Rate limit exceeded.", 429, { error: "rate_limited", retry_after: 42 });
    const checkBalance = vi.fn().mockRejectedValue(err);
    const mcp = await connect(fakeClient({ checkBalance }));
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    expect(resultText(res)).toContain("42");
    expect(checkBalance).toHaveBeenCalledTimes(1);
  });

  it("quota_and_expired_errors_are_tool_errors", async () => {
    for (const err of [
      new QuotaExceededError("You have used all your API credits for this month.", 401),
      new SubscriptionExpiredError("Subscription has expired. Please renew your subscription.", 401),
    ]) {
      const mcp = await connect(fakeClient({ checkBalance: vi.fn().mockRejectedValue(err) }));
      const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
      expect(res.isError).toBe(true);
      expect(resultText(res)).toContain(err.message);
    }
  });

  it("real_sdk_network_failure_says_could_not_reach_without_key", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("fetch failed for https://resultsza.co.za/x?api_key=SECRETKEY");
    });
    const mcp = await connect(buildClient("SECRETKEY", fetch as unknown as typeof globalThis.fetch), "SECRETKEY");
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    const text = resultText(res);
    expect(text.startsWith("Could not reach ResultsZA")).toBe(true);
    expect(text).not.toContain("SECRETKEY");
  });

  it("real_sdk_timeout_says_timed_out", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("This operation was aborted", "AbortError");
    });
    const mcp = await connect(buildClient("SECRETKEY", fetch as unknown as typeof globalThis.fetch), "SECRETKEY");
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    expect(resultText(res)).toBe("Could not reach ResultsZA: the request timed out. Try again in a minute.");
  });

  it("real_sdk_server_error_says_try_later", async () => {
    const fetch = vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 }));
    const mcp = await connect(buildClient("SECRETKEY", fetch as unknown as typeof globalThis.fetch), "SECRETKEY");
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    expect(resultText(res)).toBe("ResultsZA returned a server error (HTTP 502). Try again in a few minutes.");
  });

  it("real_sdk_not_found_keeps_api_message", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "error", message: "No results found" }), { status: 404 }));
    const mcp = await connect(buildClient("SECRETKEY", fetch as unknown as typeof globalThis.fetch), "SECRETKEY");
    const res: any = await mcp.callTool({ name: "get_lottery_results", arguments: { game: "Lotto", date: "2026-11-09" } });
    expect(res.isError).toBe(true);
    expect(resultText(res)).toBe("No results found");
  });

  it("network_error_message_has_no_key", async () => {
    const err = new TypeError("fetch failed for https://resultsza.co.za/check_api_key_balance?api_key=SECRETKEY");
    const mcp = await connect(fakeClient({ checkBalance: vi.fn().mockRejectedValue(err) }), "SECRETKEY");
    const res: any = await mcp.callTool({ name: "check_balance", arguments: {} });
    expect(res.isError).toBe(true);
    const text = resultText(res);
    expect(text.startsWith("Could not reach ResultsZA")).toBe(true);
    expect(text).not.toContain("SECRETKEY");
  });
});

describe("security", () => {
  it("key_never_in_any_tool_output", async () => {
    const leaky = fakeClient();
    for (const m of Object.keys(leaky)) {
      (leaky as any)[m] = vi.fn().mockRejectedValue(new Error("boom api_key=SECRETKEY"));
    }
    const leakyData = fakeClient();
    for (const m of Object.keys(leakyData)) {
      (leakyData as any)[m] = vi.fn().mockResolvedValue({ status: "success", echo: "SECRETKEY" });
    }
    for (const client of [leaky, leakyData]) {
      const mcp = await connect(client, "SECRETKEY");
      const { tools } = await mcp.listTools();
      for (const tool of tools) {
        const args = SAMPLE_ARGS[tool.name];
        expect(args, `SAMPLE_ARGS missing for ${tool.name}`).toBeDefined();
        const res = await mcp.callTool({ name: tool.name, arguments: args });
        expect(resultText(res), tool.name).not.toContain("SECRETKEY");
      }
    }
  });

  it("base_url_is_fixed", async () => {
    process.env.RESULTSZA_BASE_URL = "https://evil.example";
    process.env.RESULTSZA_API_URL = "https://evil.example";
    try {
      const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "success" }), { status: 200 }));
      const client = buildClient("abc", fetch as unknown as typeof globalThis.fetch);
      await client.checkBalance();
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = String((fetch.mock.calls[0] as unknown[])[0]);
      expect(url.startsWith("https://resultsza.co.za/")).toBe(true);
    } finally {
      delete process.env.RESULTSZA_BASE_URL;
      delete process.env.RESULTSZA_API_URL;
    }
  });

  it("redirects_are_refused_so_the_key_cannot_follow_them", async () => {
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      return new Response(JSON.stringify({ status: "success" }), { status: 200 });
    });
    const client = buildClient("abc", fetch as unknown as typeof globalThis.fetch);
    await client.checkBalance();
    await client.getLottoResults({});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("unknown_arguments_rejected", async () => {
    const client = fakeClient();
    const mcp = await connect(client);
    const res: any = await mcp.callTool({ name: "check_balance", arguments: { evil: 1 } });
    expect(res.isError).toBe(true);
    expect(client.checkBalance).not.toHaveBeenCalled();
  });
});
