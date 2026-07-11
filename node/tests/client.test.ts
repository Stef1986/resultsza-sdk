import { describe, expect, it } from "vitest";

import { BadRequestError, ResultsZA } from "../src/index";
import { API_KEY, lastUrl, makeClient, mockFetch } from "./helpers";

describe("client core", () => {
  it("requires an api key", () => {
    expect(() => new ResultsZA({ apiKey: "" })).toThrow();
  });

  it("sends api_key and params as query on GET, to the right path", async () => {
    const { impl, calls } = mockFetch({ status: "success", results: [] });
    await makeClient(impl).getLottoResults({ date: "2026-06-03" });

    const url = lastUrl(calls);
    expect(url.pathname).toBe("/api/get_lotto_results");
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
    expect(url.searchParams.get("date")).toBe("2026-06-03");
  });

  it("returns the parsed JSON body", async () => {
    const payload = { status: "success", results: [{ winning_numbers: [1, 2, 3, 4, 5, 6] }] };
    const { impl } = mockFetch(payload);
    expect(await makeClient(impl).getLottoResults()).toEqual(payload);
  });

  it("omits date when not provided", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getLottoResults();
    expect(lastUrl(calls).searchParams.has("date")).toBe(false);
  });

  it("uses a configurable base url", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl, { baseUrl: "https://staging.example.test" }).getLottoResults();
    expect(calls[0]!.url.startsWith("https://staging.example.test/api/")).toBe(true);
  });

  it("does not expose the api key when serialized", () => {
    const client = new ResultsZA({ apiKey: "super-secret-key" });
    expect(JSON.stringify(client)).not.toContain("super-secret-key");
  });

  it("throws BadRequestError on a 400 and redacts the key from the message", async () => {
    const { impl } = mockFetch({ status: "error", message: "bad key test-key-123" }, 400);
    await expect(makeClient(impl).getLottoResults({ date: "x" })).rejects.toThrowError(
      BadRequestError,
    );
    try {
      const { impl: impl2 } = mockFetch({ status: "error", message: "bad key test-key-123" }, 400);
      await makeClient(impl2).getLottoResults();
      throw new Error("should have thrown");
    } catch (err) {
      expect(String(err)).not.toContain("test-key-123");
      expect(String(err)).toContain("***");
    }
  });
});
