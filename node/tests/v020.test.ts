/**
 * 0.2.0 behaviour: Gosloto endpoints, client-side validation (dates, lines,
 * meetings span, checker shapes), 401 message mapping, checkBalance reporting,
 * and RateLimitError details.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  APIError,
  AuthError,
  BadRequestError,
  QuotaExceededError,
  RateLimitError,
  SubscriptionError,
  SubscriptionExpiredError,
  SubscriptionPendingError,
  ValidationError,
} from "../src/index";
import { API_KEY, lastUrl, makeClient, mockFetch } from "./helpers";

const GOSLOTO: [string, string][] = [
  ["getGosloto645Results", "/api/get_gosloto_6_45_results"],
  ["getGosloto749Results", "/api/get_gosloto_7_49_results"],
  ["getGosloto536Results", "/api/get_gosloto_5_36_results"],
];

describe("gosloto", () => {
  it.each(GOSLOTO)("%s -> %s: latest, by date, by drawId", async (method, path) => {
    const { impl, calls } = mockFetch({ status: "success", results: [] });
    const client = makeClient(impl) as any;

    await client[method]();
    let url = lastUrl(calls);
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
    expect(url.searchParams.has("date")).toBe(false);
    expect(url.searchParams.has("draw_id")).toBe(false);

    await client[method]({ date: "2026-08-06" });
    expect(lastUrl(calls).searchParams.get("date")).toBe("2026-08-06");

    await client[method]({ drawId: 18325 });
    url = lastUrl(calls);
    expect(url.searchParams.get("draw_id")).toBe("18325");
  });

  it.each(GOSLOTO)("%s rejects a bad date without calling", async (method) => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect((makeClient(impl) as any)[method]({ date: "06-08-2026" })).rejects.toThrowError(
      ValidationError,
    );
    expect(calls.length).toBe(0);
  });
});

describe("date validation", () => {
  const DATE_METHODS = [
    "getDailyLottoResults",
    "getLottoResults",
    "getLottoPlus1Results",
    "getLotto5MaxResults",
    "getSaPowerballResults",
    "getPowerballXtraResults",
    "getEuromillionsResults",
    "getIrishLottoResults",
    "getUsPowerballResults",
    "getMegamillionsResults",
    "getKenyaLottoResults",
    "getNigeriaLottoResults",
    "getGhanaLottoResults",
    ...GOSLOTO.map(([name]) => name),
  ];
  const BAD_DATES: unknown[] = [
    "2026-6-3",
    "03/06/2026",
    "2026-02-30",
    "2026-06-03T00:00",
    " 2026-06-03",
    20260603,
  ];

  for (const method of DATE_METHODS) {
    it.each(BAD_DATES)(`${method} rejects %s before any request`, async (bad) => {
      const { impl, calls } = mockFetch({ status: "success" });
      await expect((makeClient(impl) as any)[method]({ date: bad })).rejects.toThrowError(
        ValidationError,
      );
      expect(calls.length).toBe(0);
    });
  }

  it("uk49s rejects a non-existent date", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(
      makeClient(impl).getUk49sResults({ game: "UK49s Lunchtime", date: "2026-02-29" }),
    ).rejects.toThrowError(ValidationError);
    expect(calls.length).toBe(0);
  });

  it("accepts a real leap day", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getLottoResults({ date: "2028-02-29" });
    expect(lastUrl(calls).searchParams.get("date")).toBe("2028-02-29");
  });

  it("ValidationError is a BadRequestError with no status code", async () => {
    const { impl } = mockFetch({ status: "success" });
    try {
      await makeClient(impl).getLottoResults({ date: "nope" });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect(err).toBeInstanceOf(BadRequestError);
      expect(err).toBeInstanceOf(Error);
      expect((err as ValidationError).statusCode).toBeUndefined();
    }
  });
});

describe("horse racing meetings span", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // 2026-06-10 06:00 SAST is 2026-06-10 04:00 UTC.
  const pinToday = () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-10T04:00:00Z"));
  };

  it("checks the span against today when only fromDate is given", async () => {
    pinToday();
    const { impl, calls } = mockFetch({ status: "success" });
    const client = makeClient(impl);
    await expect(client.getHorseRacingMeetings({ fromDate: "2026-06-02" })).rejects.toThrowError(
      ValidationError,
    );
    expect(calls.length).toBe(0);

    await client.getHorseRacingMeetings({ fromDate: "2026-06-03" }); // exactly 7 days
    const url = lastUrl(calls);
    expect(url.searchParams.get("from_date")).toBe("2026-06-03");
    expect(url.searchParams.has("to_date")).toBe(false);
  });

  it("uses South African time for today", async () => {
    // 23:30 UTC on 2026-06-09 is already 01:30 on 2026-06-10 in South Africa.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-09T23:30:00Z"));
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getHorseRacingMeetings({ fromDate: "2026-06-03" });
    expect(calls.length).toBe(1);
  });

  it("rejects a fromDate in the future", async () => {
    pinToday();
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(
      makeClient(impl).getHorseRacingMeetings({ fromDate: "2026-06-11" }),
    ).rejects.toThrowError(ValidationError);
    expect(calls.length).toBe(0);
  });

  it("checks the span against the default fromDate when only toDate is given", async () => {
    pinToday();
    const { impl, calls } = mockFetch({ status: "success" });
    const client = makeClient(impl);
    await expect(client.getHorseRacingMeetings({ toDate: "2026-06-11" })).rejects.toThrowError(
      ValidationError,
    );
    await expect(client.getHorseRacingMeetings({ toDate: "2026-06-02" })).rejects.toThrowError(
      ValidationError,
    );
    expect(calls.length).toBe(0);
    await client.getHorseRacingMeetings({ toDate: "2026-06-09" });
    expect(calls.length).toBe(1);
  });

  it.each([
    { fromDate: "2026-6-1" },
    { toDate: "2026/06/07" },
    { fromDate: "2026-02-29", toDate: "2026-03-01" },
    { fromDate: "2026-06-01", toDate: "2026-06-31" },
  ])("rejects bad dates %o without calling", async (opts) => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(makeClient(impl).getHorseRacingMeetings(opts)).rejects.toThrowError(
      ValidationError,
    );
    expect(calls.length).toBe(0);
  });

  it("racecard and runner reject bad dates", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    const client = makeClient(impl);
    await expect(
      client.getHorseRacingResults({ date: "22-06-2026", venue: "Greyville" }),
    ).rejects.toThrowError(ValidationError);
    await expect(
      client.getHorseRacingRace({ date: "2026-13-01", venue: "Greyville", raceNo: 1 }),
    ).rejects.toThrowError(ValidationError);
    expect(calls.length).toBe(0);
  });
});

describe("generateRandomNumbers lines", () => {
  it.each([0, -1, 501, 2.5, "5", true])("rejects lines=%s without calling", async (bad) => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(
      makeClient(impl).generateRandomNumbers({ game: "Lotto", lines: bad as any }),
    ).rejects.toThrowError(ValidationError);
    expect(calls.length).toBe(0);
  });

  it.each([1, 500])("accepts lines=%s", async (ok) => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).generateRandomNumbers({ game: "Gosloto 6/45", lines: ok });
    expect(lastUrl(calls).searchParams.get("lines")).toBe(String(ok));
  });
});

describe("checkers", () => {
  it("bulkCheckNumbers wraps a flat single line into [line]", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).bulkCheckNumbers({
      game: "Lotto",
      date: "2026-06-03",
      playedNumbers: [1, 2, 3, 4, 5, 6],
    });
    expect(JSON.parse(calls[0]!.body!).played_numbers).toEqual([[1, 2, 3, 4, 5, 6]]);
  });

  it("bulkCheckNumbers sends a list of lines unchanged", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    const lines = Array.from({ length: 50 }, () => [1, 2, 3, 4, 5, 6]);
    await makeClient(impl).bulkCheckNumbers({ game: "Lotto", date: "2026-06-03", playedNumbers: lines });
    expect(JSON.parse(calls[0]!.body!).played_numbers).toEqual(lines);
  });

  it("both checkers reject a mix of numbers and lines", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    const client = makeClient(impl);
    const mixed = [[1, 2, 3, 4, 5, 6], 7] as any;
    await expect(
      client.checkPlayedNumbers({ game: "Lotto", date: "2026-06-03", playedNumbers: mixed }),
    ).rejects.toThrowError(ValidationError);
    await expect(
      client.bulkCheckNumbers({ game: "Lotto", date: "2026-06-03", playedNumbers: mixed }),
    ).rejects.toThrowError(ValidationError);
    expect(calls.length).toBe(0);
  });

  it.each(["2026-6-3", "03/06/2026", "2026-02-30", "20260603"])(
    "both checkers reject date %s without calling",
    async (bad) => {
      const { impl, calls } = mockFetch({ status: "success" });
      const client = makeClient(impl);
      await expect(
        client.checkPlayedNumbers({ game: "Lotto", date: bad, playedNumbers: [1, 2, 3, 4, 5, 6] }),
      ).rejects.toThrowError(ValidationError);
      await expect(
        client.bulkCheckNumbers({ game: "Lotto", date: bad, playedNumbers: [[1, 2, 3, 4, 5, 6]] }),
      ).rejects.toThrowError(ValidationError);
      expect(calls.length).toBe(0);
    },
  );
});

describe("401 message mapping", () => {
  const CASES: [string, Function][] = [
    ["Subscription has expired. Please renew your subscription.", SubscriptionExpiredError],
    ["API key expired", SubscriptionExpiredError],
    ["Subscription is not active. Please renew your subscription.", SubscriptionError],
    [
      "You are out of API credits. Please acquire more tokens or upgrade your subscription.",
      QuotaExceededError,
    ],
    [
      "You have used all your API credits for this month. Purchase a call top-up to get " +
        "through the rest of the month, or upgrade your subscription for a higher monthly limit.",
      QuotaExceededError,
    ],
    ["Monthly API limit would be exceeded. You have 3 calls remaining this month.", QuotaExceededError],
    ["Daily API request quota reached. Please purchase a subscription.", QuotaExceededError],
    ["Not enough API requests remaining", QuotaExceededError],
    ["Invalid API key", AuthError],
    ["API key is not active", AuthError],
    ["Internal Server Error", AuthError],
  ];

  it.each(CASES)("%s", async (message, expected) => {
    const { impl } = mockFetch({ status: "error", message }, 401);
    try {
      await makeClient(impl).getLottoResults();
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as object).constructor).toBe(expected);
      expect((err as APIError).statusCode).toBe(401);
      // Every 401 is still an AuthError, so 0.1.x `instanceof AuthError` code works.
      expect(err).toBeInstanceOf(AuthError);
    }
  });

  it("keeps the hierarchy backward compatible", () => {
    expect(new QuotaExceededError("x")).toBeInstanceOf(AuthError);
    expect(new SubscriptionError("x")).toBeInstanceOf(AuthError);
    expect(new SubscriptionExpiredError("x")).toBeInstanceOf(SubscriptionError);
    expect(new SubscriptionPendingError("x")).toBeInstanceOf(SubscriptionError);
    expect(new AuthError("x")).toBeInstanceOf(APIError);
    expect(new QuotaExceededError("x").name).toBe("QuotaExceededError");
  });

  it("maps HTTP 500 to a plain APIError", async () => {
    const { impl } = mockFetch({ status: "error", message: "Internal Server Error" }, 500);
    try {
      await makeClient(impl).getLottoResults();
      throw new Error("should have thrown");
    } catch (err) {
      expect((err as object).constructor).toBe(APIError);
      expect((err as APIError).statusCode).toBe(500);
    }
  });
});

describe("rate limiting", () => {
  it("exposes retryAfter, cooldown and X-RateLimit headers", async () => {
    const { impl } = mockFetch(
      {
        error: "rate_limited",
        message: "Rate limit exceeded. You are in a 5-minute cooldown period.",
        retry_after: 300,
        cooldown: true,
        cooldown_remaining: 300,
      },
      429,
      {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": "1767225600",
        "X-RateLimit-Cooldown": "300",
      },
    );
    try {
      await makeClient(impl).getLottoResults();
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      const e = err as RateLimitError;
      expect(e.statusCode).toBe(429);
      expect(e.retryAfter).toBe(300);
      expect(e.cooldown).toBe(true);
      expect(e.cooldownRemaining).toBe(300);
      expect(e.limit).toBe(60);
      expect(e.remaining).toBe(0);
      expect(e.reset).toBe(1767225600);
      expect(e.message).toContain("cooldown");
    }
  });

  it("works without cooldown or headers", async () => {
    const { impl } = mockFetch(
      {
        error: "rate_limited",
        message: "Too many requests. Unlimited plan is subject to rate limits.",
        retry_after: 12,
        cooldown: false,
        cooldown_remaining: null,
      },
      429,
    );
    try {
      await makeClient(impl).getLottoResults();
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as RateLimitError;
      expect(e.retryAfter).toBe(12);
      expect(e.cooldown).toBe(false);
      expect(e.cooldownRemaining).toBeUndefined();
      expect(e.limit).toBeUndefined();
    }
  });

  it("accepts a plain header record", () => {
    const e = new RateLimitError("x", 429, {}, { "retry-after": "7", "x-ratelimit-limit": "60" });
    expect(e.retryAfter).toBe(7);
    expect(e.limit).toBe(60);
  });
});

describe("checkBalance reporting", () => {
  it("returns the 403 out-of-credits body instead of throwing", async () => {
    const body = {
      status: "error",
      billing_model: "subscription",
      message: "You have used all your API credits for this month.",
      tier: "starter",
      monthly_limit: 6000,
      used: 6000,
      remaining: 0,
      subscription_status: "active",
      subscription_end: "2026-12-01",
      days_until_expiry: 21,
      usage_breakdown: [],
    };
    const { impl } = mockFetch(body, 403);
    expect(await makeClient(impl).checkBalance()).toEqual(body);
  });

  it("reports an expired subscription without throwing", async () => {
    const { impl } = mockFetch({
      status: "error",
      subscription_status: "expired",
      message: "gone",
    });
    const data = await makeClient(impl).checkBalance();
    expect(data.subscription_status).toBe("expired");
  });

  it("reports subscription_status none", async () => {
    const { impl } = mockFetch({
      status: "success",
      billing_model: "subscription",
      subscription_status: "none",
      tier: null,
      push_subscription: null,
    });
    const data = await makeClient(impl).checkBalance();
    expect(data.subscription_status).toBe("none");
    expect(data.push_subscription).toBeNull();
  });

  it("throws AuthError for an unknown key (404)", async () => {
    const { impl } = mockFetch({ status: "error", message: "API key not found." }, 404);
    try {
      await makeClient(impl).checkBalance();
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).statusCode).toBe(404);
      expect((err as AuthError).message).toBe("API key not found.");
    }
  });
});
