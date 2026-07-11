/**
 * Thin client for the ResultsZA REST API. Each method builds the request
 * (correct verb, correct param placement) and returns the parsed JSON.
 * Responses are intentionally untyped: some endpoints return different shapes
 * per game, so the raw parsed JSON is handed back for the caller to inspect.
 *
 * Auth: the API key travels as an `api_key` query parameter, except the balance
 * endpoint, which takes it in the body to keep it out of the URL. Any key that
 * would surface in an error message is redacted.
 */
import {
  APIError,
  AuthError,
  BadRequestError,
  RateLimitError,
  ResultsZAError,
  SubscriptionExpiredError,
  SubscriptionPendingError,
} from "./errors";

const DEFAULT_BASE_URL = "https://resultsza.co.za";

export interface ClientOptions {
  /** Your ResultsZA API key (https://resultsza.co.za/generate_api_key). */
  apiKey: string;
  /** Override the API host (useful for testing). */
  baseUrl?: string;
  /** Per-request timeout in milliseconds (default 30000). */
  timeoutMs?: number;
  /** Custom fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

type ParamValue = string | number | undefined | null;
type Params = Record<string, ParamValue>;

interface RequestOptions {
  params?: Params;
  body?: unknown;
  apiKeyInBody?: boolean;
  raiseOnErrorBody?: boolean;
}

export class ResultsZA {
  readonly baseUrl: string;
  readonly #apiKey: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options || !options.apiKey) {
      throw new Error(
        "apiKey is required. Get one at https://resultsza.co.za/generate_api_key",
      );
    }
    this.#apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) {
      throw new Error(
        "global fetch is unavailable. Use Node 20+ or pass a fetchImpl option.",
      );
    }
    this.#fetch = fetchImpl;
  }

  // --- request plumbing -----------------------------------------------

  #redact(text: string): string {
    if (this.#apiKey && text.includes(this.#apiKey)) {
      return text.split(this.#apiKey).join("***");
    }
    return text;
  }

  #get(path: string, params?: Params): Promise<any> {
    return this.#request("GET", path, { params });
  }

  #post(path: string, options: RequestOptions = {}): Promise<any> {
    return this.#request("POST", path, options);
  }

  async #request(method: string, path: string, options: RequestOptions): Promise<any> {
    const { params = {}, body, apiKeyInBody = false, raiseOnErrorBody = true } = options;

    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }

    let payload = body;
    if (apiKeyInBody) {
      payload = { ...((body as Record<string, unknown>) ?? {}), api_key: this.#apiKey };
    } else {
      url.searchParams.set("api_key", this.#apiKey);
    }

    const headers: Record<string, string> = {};
    let requestBody: string | undefined;
    if (payload !== undefined) {
      headers["content-type"] = "application/json";
      requestBody = JSON.stringify(payload);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    let response: Response;
    try {
      response = await this.#fetch(url.toString(), {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ResultsZAError(this.#redact(message));
    } finally {
      clearTimeout(timer);
    }

    return this.#handle(response, raiseOnErrorBody);
  }

  async #handle(response: Response, raiseOnErrorBody: boolean): Promise<any> {
    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    const isErrorBody =
      raiseOnErrorBody && data && typeof data === "object" && data.status === "error";
    if (!response.ok || isErrorBody) {
      this.#raise(response.status, data);
    }
    return data;
  }

  #raise(status: number, data: any): never {
    const message: string | undefined = data?.message;
    const subscription: string | undefined = data?.subscription_status;
    const msg = this.#redact(message || `HTTP ${status}`);

    if (subscription === "expired") throw new SubscriptionExpiredError(msg, status, data);
    if (subscription === "pending") throw new SubscriptionPendingError(msg, status, data);
    if (status === 401 || status === 403) throw new AuthError(msg, status, data);
    if (status === 429) throw new RateLimitError(msg, status, data);
    if (status === 400) throw new BadRequestError(msg, status, data);
    throw new APIError(msg, status, data);
  }

  // ================================================================
  // Endpoints
  // ================================================================

  // --- South Africa (date optional; omit for the latest draw) ---------

  getDailyLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_daily_lotto_results", { date: options.date });
  }

  getLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_lotto_results", { date: options.date });
  }

  getLottoPlus1Results(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_lotto_plus_1_results", { date: options.date });
  }

  getLotto5MaxResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_lotto_5_max_results", { date: options.date });
  }

  getSaPowerballResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_sa_powerball_results", { date: options.date });
  }

  getPowerballXtraResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_powerball_xtra_results", { date: options.date });
  }

  // --- Africa ---------------------------------------------------------

  /** Kenya Lotto. `drawType` maps to the `type` param: "daily" or "jackpot". */
  getKenyaLottoResults(
    options: { date?: string; drawType?: "daily" | "jackpot" } = {},
  ): Promise<any> {
    return this.#get("/api/get_kenya_lotto_results", {
      date: options.date,
      type: options.drawType,
    });
  }

  /** Nigeria (Premier Lotto). Omit `game` for all games on the date. */
  getNigeriaLottoResults(options: { game?: string; date?: string } = {}): Promise<any> {
    return this.#get("/api/get_nigeria_lotto_results", {
      game: options.game,
      date: options.date,
    });
  }

  /** Ghana Lotto. Omit `game` for all games on the date. */
  getGhanaLottoResults(options: { game?: string; date?: string } = {}): Promise<any> {
    return this.#get("/api/get_ghana_lotto_results", {
      game: options.game,
      date: options.date,
    });
  }

  // --- United Kingdom -------------------------------------------------

  /** UK 49's. `game` is required (e.g. "UK49s Lunchtime"). */
  async getUk49sResults(options: { game: string; date?: string }): Promise<any> {
    if (!options?.game) {
      throw new Error(
        "game is required for UK 49's: one of 'UK49s Brunchtime', 'UK49s Lunchtime', " +
          "'UK49s Drivetime', 'UK49s Teatime'.",
      );
    }
    return this.#get("/api/get_uk49s_results", { game: options.game, date: options.date });
  }

  // --- Europe ---------------------------------------------------------

  getEuromillionsResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_euromillions_results", { date: options.date });
  }

  getIrishLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_irish_lotto_results", { date: options.date });
  }

  // --- United States --------------------------------------------------

  getUsPowerballResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_us_powerball_results", { date: options.date });
  }

  getMegamillionsResults(options: { date?: string } = {}): Promise<any> {
    return this.#get("/api/get_megamillions_results", { date: options.date });
  }

  // --- Horse racing ---------------------------------------------------

  /**
   * List race meetings. The span may not exceed 7 days; this is validated
   * client-side to avoid wasting an API call on a request the server rejects.
   */
  async getHorseRacingMeetings(options: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const { fromDate, toDate } = options;
    if (fromDate && toDate) {
      const span = daySpan(fromDate, toDate);
      if (span < 0) throw new Error("toDate must not be before fromDate.");
      if (span > 7) {
        throw new Error(
          "Date range too wide: a maximum of 7 days can be queried per call.",
        );
      }
    }
    return this.#get("/api/get_horse_racing_meetings", {
      from_date: fromDate,
      to_date: toDate,
    });
  }

  /** Full race card for one venue on one day. Both fields are required. */
  async getHorseRacingResults(options: { date: string; venue: string }): Promise<any> {
    if (!options?.date || !options?.venue) {
      throw new Error("date and venue are both required for a race card.");
    }
    return this.#get("/api/get_horse_racing_results", {
      date: options.date,
      venue: options.venue,
    });
  }

  /** Runner table for a single race. `raceNo` is 1-based. All fields required. */
  async getHorseRacingRace(options: { date: string; venue: string; raceNo: number }): Promise<any> {
    if (!options?.date || !options?.venue || options?.raceNo == null) {
      throw new Error("date, venue and raceNo are all required for a runner table.");
    }
    return this.#get("/api/get_horse_racing_race", {
      date: options.date,
      venue: options.venue,
      race_no: options.raceNo,
    });
  }

  // --- Number generators ----------------------------------------------

  /** Generate random lines. One request costs a single call regardless of `lines`. */
  async generateRandomNumbers(options: { game: string; lines?: number }): Promise<any> {
    if (!options?.game) throw new Error("game is required.");
    return this.#get("/api/generate_random_numbers", {
      game: options.game,
      lines: options.lines,
    });
  }

  /**
   * Deterministically turn `text` into lucky numbers. POST: api_key and game
   * are query params, text is in the body.
   */
  async textToLuckyNumbers(options: { game: string; text: string }): Promise<any> {
    if (!options?.game) throw new Error("game is required.");
    if (!options?.text) throw new Error("text is required.");
    return this.#post("/api/text_to_lucky_numbers", {
      params: { game: options.game },
      body: { text: options.text },
    });
  }

  // --- Analysis -------------------------------------------------------

  async getHotColdNumbers(options: { product: string }): Promise<any> {
    if (!options?.product) throw new Error("product is required.");
    return this.#get("/api/get_hot_cold_numbers_stats", { product: options.product });
  }

  async getNumberFrequencies(options: { product: string }): Promise<any> {
    if (!options?.product) throw new Error("product is required.");
    return this.#get("/api/get_number_frequencies", { product: options.product });
  }

  async getNumberPairs(options: { product: string }): Promise<any> {
    if (!options?.product) throw new Error("product is required.");
    return this.#get("/api/get_number_pairs", { product: options.product });
  }

  // --- Checkers (SA games only) ---------------------------------------

  /** Check played lines against a SA draw. Up to 10 lines, costs 1 call. */
  checkPlayedNumbers(options: {
    game: string;
    date: string;
    playedNumbers: number[] | number[][];
  }): Promise<any> {
    return this.#check("/api/check_played_numbers", options, 10);
  }

  /** Bulk-check up to 500 lines. Costs 5 calls per 50 lines (or part thereof). */
  bulkCheckNumbers(options: {
    game: string;
    date: string;
    playedNumbers: number[] | number[][];
  }): Promise<any> {
    return this.#check("/api/bulk_check_numbers", options, 500);
  }

  async #check(
    path: string,
    options: { game: string; date: string; playedNumbers: number[] | number[][] },
    maxLines: number,
  ): Promise<any> {
    const { game, date, playedNumbers } = options ?? ({} as typeof options);
    if (!game) throw new Error("game is required (SA games only).");
    if (!date) throw new Error("date is required (YYYY-MM-DD).");
    if (!playedNumbers || playedNumbers.length === 0) {
      throw new Error("playedNumbers is required.");
    }
    const count = lineCount(playedNumbers);
    if (count > maxLines) {
      throw new Error(
        `Too many lines: ${count} supplied, but this endpoint accepts at most ${maxLines}.`,
      );
    }
    return this.#post(path, {
      params: { game, date },
      body: { played_numbers: playedNumbers },
    });
  }

  // --- Account --------------------------------------------------------

  /**
   * Remaining calls and subscription status. Free (consumes no calls). The path
   * has no `/api/` prefix and the key rides in the body to stay out of the URL.
   * Reports pending/expired status rather than throwing.
   */
  checkBalance(): Promise<any> {
    return this.#post("/check_api_key_balance", {
      apiKeyInBody: true,
      raiseOnErrorBody: false,
    });
  }
}

function daySpan(fromDate: string, toDate: string): number {
  const a = Date.parse(`${fromDate}T00:00:00Z`);
  const b = Date.parse(`${toDate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error("fromDate and toDate must be 'YYYY-MM-DD' strings.");
  }
  return Math.round((b - a) / 86_400_000);
}

function lineCount(playedNumbers: number[] | number[][]): number {
  if (
    Array.isArray(playedNumbers) &&
    playedNumbers.length > 0 &&
    playedNumbers.every((line) => Array.isArray(line))
  ) {
    return playedNumbers.length;
  }
  return 1;
}
