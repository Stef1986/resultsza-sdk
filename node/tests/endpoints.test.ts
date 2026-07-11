import { describe, expect, it } from "vitest";

import { API_KEY, lastUrl, makeClient, mockFetch } from "./helpers";

const DATE_ONLY: [string, string][] = [
  ["getDailyLottoResults", "/api/get_daily_lotto_results"],
  ["getLottoResults", "/api/get_lotto_results"],
  ["getLottoPlus1Results", "/api/get_lotto_plus_1_results"],
  ["getLotto5MaxResults", "/api/get_lotto_5_max_results"],
  ["getSaPowerballResults", "/api/get_sa_powerball_results"],
  ["getPowerballXtraResults", "/api/get_powerball_xtra_results"],
  ["getEuromillionsResults", "/api/get_euromillions_results"],
  ["getIrishLottoResults", "/api/get_irish_lotto_results"],
  ["getUsPowerballResults", "/api/get_us_powerball_results"],
  ["getMegamillionsResults", "/api/get_megamillions_results"],
];

describe("result endpoints", () => {
  it.each(DATE_ONLY)("%s -> %s with date + api_key", async (method, path) => {
    const { impl, calls } = mockFetch({ status: "success" });
    await (makeClient(impl) as any)[method]({ date: "2026-06-03" });
    const url = lastUrl(calls);
    expect(url.pathname).toBe(path);
    expect(url.searchParams.get("date")).toBe("2026-06-03");
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
  });

  it("kenya maps drawType to the type param", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getKenyaLottoResults({ date: "2026-06-03", drawType: "jackpot" });
    const url = lastUrl(calls);
    expect(url.pathname).toBe("/api/get_kenya_lotto_results");
    expect(url.searchParams.get("type")).toBe("jackpot");
  });

  it("nigeria game is optional", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    const client = makeClient(impl);
    await client.getNigeriaLottoResults();
    expect(lastUrl(calls).searchParams.has("game")).toBe(false);
    await client.getNigeriaLottoResults({ game: "PREMIER PEOPLES" });
    expect(lastUrl(calls).searchParams.get("game")).toBe("PREMIER PEOPLES");
  });

  it("uk49s requires game", async () => {
    const { impl } = mockFetch({ status: "success" });
    await expect(makeClient(impl).getUk49sResults({} as any)).rejects.toThrow();
  });

  it("uk49s sends game", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getUk49sResults({ game: "UK49s Lunchtime", date: "2026-06-03" });
    expect(lastUrl(calls).searchParams.get("game")).toBe("UK49s Lunchtime");
  });
});

describe("horse racing", () => {
  it("meetings sends the date range", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).getHorseRacingMeetings({ fromDate: "2026-06-01", toDate: "2026-06-07" });
    const url = lastUrl(calls);
    expect(url.searchParams.get("from_date")).toBe("2026-06-01");
    expect(url.searchParams.get("to_date")).toBe("2026-06-07");
  });

  it("meetings rejects a span over 7 days without calling", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(
      makeClient(impl).getHorseRacingMeetings({ fromDate: "2026-06-01", toDate: "2026-06-10" }),
    ).rejects.toThrow();
    expect(calls.length).toBe(0);
  });

  it("meetings allows an exact 7-day span", async () => {
    const { impl } = mockFetch({ status: "success" });
    await makeClient(impl).getHorseRacingMeetings({ fromDate: "2026-06-01", toDate: "2026-06-08" });
  });

  it("racecard requires date and venue", async () => {
    const { impl } = mockFetch({ status: "success" });
    await expect(makeClient(impl).getHorseRacingResults({ date: "2026-06-03" } as any)).rejects.toThrow();
    await expect(makeClient(impl).getHorseRacingResults({ venue: "Greyville" } as any)).rejects.toThrow();
  });

  it("runner requires raceNo and sends it", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await expect(
      makeClient(impl).getHorseRacingRace({ date: "2026-06-03", venue: "Greyville" } as any),
    ).rejects.toThrow();
    await makeClient(impl).getHorseRacingRace({ date: "2026-06-03", venue: "Greyville", raceNo: 4 });
    expect(lastUrl(calls).searchParams.get("race_no")).toBe("4");
  });
});

describe("number tools", () => {
  it("generateRandomNumbers sends game and lines", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).generateRandomNumbers({ game: "Lotto", lines: 5 });
    const url = lastUrl(calls);
    expect(url.searchParams.get("game")).toBe("Lotto");
    expect(url.searchParams.get("lines")).toBe("5");
  });

  it("generateRandomNumbers requires game", async () => {
    const { impl } = mockFetch({ status: "success" });
    await expect(makeClient(impl).generateRandomNumbers({} as any)).rejects.toThrow();
  });

  it("textToLuckyNumbers: key+game in query, text in body", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).textToLuckyNumbers({ game: "Lotto", text: "hello" });
    const call = calls[calls.length - 1]!;
    const url = new URL(call.url);
    expect(call.method).toBe("POST");
    expect(url.searchParams.get("game")).toBe("Lotto");
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
    const body = JSON.parse(call.body!);
    expect(body.text).toBe("hello");
    expect(body.api_key).toBeUndefined();
  });

  it.each(["getHotColdNumbers", "getNumberFrequencies", "getNumberPairs"])(
    "%s sends product and requires it",
    async (method) => {
      const { impl, calls } = mockFetch({ status: "success" });
      const client = makeClient(impl);
      await (client as any)[method]({ product: "Lotto" });
      expect(lastUrl(calls).searchParams.get("product")).toBe("Lotto");
      await expect((client as any)[method]({} as any)).rejects.toThrow();
    },
  );
});

describe("checkers", () => {
  it("checkPlayedNumbers: key+game+date in query, playedNumbers in body", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    await makeClient(impl).checkPlayedNumbers({
      game: "Lotto",
      date: "2026-07-08",
      playedNumbers: [1, 6, 29, 11, 15, 17],
    });
    const call = calls[calls.length - 1]!;
    const url = new URL(call.url);
    expect(call.method).toBe("POST");
    expect(url.searchParams.get("game")).toBe("Lotto");
    expect(url.searchParams.get("date")).toBe("2026-07-08");
    expect(url.searchParams.get("api_key")).toBe(API_KEY);
    const body = JSON.parse(call.body!);
    expect(body.played_numbers).toEqual([1, 6, 29, 11, 15, 17]);
    expect(body.api_key).toBeUndefined();
  });

  it("checkPlayedNumbers rejects over 10 lines without calling", async () => {
    const { impl, calls } = mockFetch({ status: "success" });
    const lines = Array.from({ length: 11 }, () => [1, 2, 3, 4, 5, 6]);
    await expect(
      makeClient(impl).checkPlayedNumbers({ game: "Lotto", date: "2026-07-08", playedNumbers: lines }),
    ).rejects.toThrow();
    expect(calls.length).toBe(0);
  });

  it("bulkCheckNumbers rejects over 500 lines", async () => {
    const { impl } = mockFetch({ status: "success" });
    const lines = Array.from({ length: 501 }, () => [1, 2, 3, 4, 5, 6]);
    await expect(
      makeClient(impl).bulkCheckNumbers({ game: "Lotto", date: "2026-07-08", playedNumbers: lines }),
    ).rejects.toThrow();
  });
});

describe("account", () => {
  it("checkBalance: unprefixed path, key in body, no key in url", async () => {
    const { impl, calls } = mockFetch({ status: "success", remaining: 6000 });
    const data = await makeClient(impl).checkBalance();
    const call = calls[0]!;
    const url = new URL(call.url);
    expect(call.method).toBe("POST");
    expect(url.pathname).toBe("/check_api_key_balance");
    expect(url.searchParams.has("api_key")).toBe(false);
    expect(JSON.parse(call.body!).api_key).toBe(API_KEY);
    expect(data.remaining).toBe(6000);
  });
});
