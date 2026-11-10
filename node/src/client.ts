/**
 * Thin client for the ResultsZA REST API. Each method builds the request
 * (correct verb, correct param placement) and returns the parsed JSON.
 * Responses are intentionally untyped: some endpoints return different shapes
 * per game, so the raw parsed JSON is handed back for the caller to inspect.
 *
 * Auth: the API key travels as an `api_key` query parameter on every endpoint,
 * GET and POST alike, because that is where the API reads it. The one exception
 * is checkBalance(), which sends the key in the JSON body. Any key that would
 * surface in an error message is redacted.
 *
 * Client-side validation (dates, line counts, the meetings span, required
 * params) throws ValidationError before any HTTP request, so bad input never
 * costs a round trip.
 */
import {
  APIError,
  AuthError,
  BadRequestError,
  QuotaExceededError,
  RateLimitError,
  ResultsZAError,
  SubscriptionError,
  SubscriptionExpiredError,
  SubscriptionPendingError,
  ValidationError,
} from "./errors";

const DEFAULT_BASE_URL = "https://resultsza.co.za";
const SIGNUP_URL = "https://resultsza.co.za/signup";

/** South African Standard Time is UTC+2 all year (no daylight saving). */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/**
 * 401 messages that mean "valid key, no calls left". Matched case-insensitively
 * as substrings of the API's message.
 */
const QUOTA_MESSAGES = [
  "you are out of api credits",
  "you have used all your api credits for this month",
  "monthly api limit would be exceeded",
  "daily api request quota reached",
  "not enough api requests remaining",
  "you have used all your free backlink api calls",
];

type PlayedNumbers = number[] | number[][];

export interface ClientOptions {
  /**
   * Your ResultsZA API key. Create a free account at
   * https://resultsza.co.za/signup, then generate the key in My Dashboard.
   */
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
  /** Statuses whose JSON body is returned instead of thrown. */
  reportStatuses?: number[];
}

export class ResultsZA {
  readonly baseUrl: string;
  readonly #apiKey: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options || !options.apiKey) {
      throw new Error(
        `apiKey is required. Create a free account at ${SIGNUP_URL}, then generate a key in My Dashboard.`,
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
    const {
      params = {},
      body,
      apiKeyInBody = false,
      raiseOnErrorBody = true,
      reportStatuses = [],
    } = options;

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

    return this.#handle(response, raiseOnErrorBody, reportStatuses);
  }

  async #handle(
    response: Response,
    raiseOnErrorBody: boolean,
    reportStatuses: number[],
  ): Promise<any> {
    const text = await response.text();
    let data: any = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }

    // Some statuses carry a report the caller asked for (checkBalance's 403
    // out-of-credits body), so hand the body back instead of throwing.
    if (reportStatuses.includes(response.status) && data && typeof data === "object") {
      return data;
    }

    const isErrorBody =
      raiseOnErrorBody && data && typeof data === "object" && data.status === "error";
    if (!response.ok || isErrorBody) {
      this.#raise(response, data);
    }
    return data;
  }

  #raise(response: Response, data: any): never {
    const status = response.status;
    const message: string | undefined = data?.message;
    const subscription: string | undefined = data?.subscription_status;
    const msg = this.#redact(message || `HTTP ${status}`);

    if (subscription === "expired") throw new SubscriptionExpiredError(msg, status, data);
    if (subscription === "pending") throw new SubscriptionPendingError(msg, status, data);
    if (status === 401 || status === 403) {
      const ErrorClass = classifyAuth(message ?? "");
      throw new ErrorClass(msg, status, data);
    }
    if (status === 429) throw new RateLimitError(msg, status, data, response.headers);
    if (status === 400) throw new BadRequestError(msg, status, data);
    throw new APIError(msg, status, data);
  }

  // ================================================================
  // Endpoints
  // ================================================================

  // --- South Africa (date optional; omit for the latest draw) ---------

  async #byDate(path: string, options: { date?: string } = {}): Promise<any> {
    checkDate("date", options?.date);
    return this.#get(path, { date: options?.date });
  }

  getDailyLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_daily_lotto_results", options);
  }

  getLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_lotto_results", options);
  }

  getLottoPlus1Results(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_lotto_plus_1_results", options);
  }

  /** Lotto 5 Max (replaced Lotto Plus 2 from 2026-06-01). */
  getLotto5MaxResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_lotto_5_max_results", options);
  }

  getSaPowerballResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_sa_powerball_results", options);
  }

  /** Powerball Xtra (renamed from Powerball Plus, 2026-06-01). */
  getPowerballXtraResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_powerball_xtra_results", options);
  }

  // --- Africa ---------------------------------------------------------

  /**
   * Kenya Lotto. `drawType` maps to the `type` param: "daily" or "jackpot".
   * `date` returns all draws for that day, newest first.
   */
  async getKenyaLottoResults(
    options: { date?: string; drawType?: "daily" | "jackpot" } = {},
  ): Promise<any> {
    checkDate("date", options?.date);
    return this.#get("/api/get_kenya_lotto_results", {
      date: options?.date,
      type: options?.drawType,
    });
  }

  /** Nigeria (Premier Lotto). Omit `game` for all games on the date. */
  async getNigeriaLottoResults(options: { game?: string; date?: string } = {}): Promise<any> {
    checkDate("date", options?.date);
    return this.#get("/api/get_nigeria_lotto_results", {
      game: options?.game,
      date: options?.date,
    });
  }

  /** Ghana Lotto. Omit `game` for all games on the date. */
  async getGhanaLottoResults(options: { game?: string; date?: string } = {}): Promise<any> {
    checkDate("date", options?.date);
    return this.#get("/api/get_ghana_lotto_results", {
      game: options?.game,
      date: options?.date,
    });
  }

  // --- United Kingdom -------------------------------------------------

  /** UK 49's. `game` is required (e.g. "UK49s Lunchtime"). */
  async getUk49sResults(options: { game: string; date?: string }): Promise<any> {
    if (!options?.game) {
      throw new ValidationError(
        "game is required for UK 49's: one of 'UK49s Brunchtime', 'UK49s Lunchtime', " +
          "'UK49s Drivetime', 'UK49s Teatime'.",
      );
    }
    checkDate("date", options.date);
    return this.#get("/api/get_uk49s_results", { game: options.game, date: options.date });
  }

  // --- Europe ---------------------------------------------------------

  getEuromillionsResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_euromillions_results", options);
  }

  getIrishLottoResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_irish_lotto_results", options);
  }

  // --- United States --------------------------------------------------

  getUsPowerballResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_us_powerball_results", options);
  }

  getMegamillionsResults(options: { date?: string } = {}): Promise<any> {
    return this.#byDate("/api/get_megamillions_results", options);
  }

  // --- Russia (Gosloto: many draws a day) -----------------------------

  async #gosloto(
    path: string,
    options: { date?: string; drawId?: string | number } = {},
  ): Promise<any> {
    checkDate("date", options?.date);
    const drawId = options?.drawId;
    return this.#get(path, {
      date: options?.date,
      draw_id: drawId === undefined || drawId === null ? undefined : String(drawId),
    });
  }

  /**
   * Gosloto 6/45. Omit both options for the latest draw. `date` (YYYY-MM-DD)
   * returns every draw that day, newest first. `drawId` returns that single
   * draw; the server ignores it when `date` is also given.
   */
  getGosloto645Results(options: { date?: string; drawId?: string | number } = {}): Promise<any> {
    return this.#gosloto("/api/get_gosloto_6_45_results", options);
  }

  /** Gosloto 7/49. Same options as getGosloto645Results. */
  getGosloto749Results(options: { date?: string; drawId?: string | number } = {}): Promise<any> {
    return this.#gosloto("/api/get_gosloto_7_49_results", options);
  }

  /** Gosloto 5/36. Same options as getGosloto645Results. */
  getGosloto536Results(options: { date?: string; drawId?: string | number } = {}): Promise<any> {
    return this.#gosloto("/api/get_gosloto_5_36_results", options);
  }

  // --- Horse racing ---------------------------------------------------

  /**
   * List race meetings. `fromDate` defaults to 7 days ago and `toDate` to today
   * (server-side, South African time). The span may not exceed 7 days,
   * including when only one end is given (the other end then takes its
   * default). This is validated client-side to avoid a round trip the server
   * would reject.
   */
  async getHorseRacingMeetings(options: { fromDate?: string; toDate?: string } = {}): Promise<any> {
    const { fromDate, toDate } = options ?? {};
    checkDate("fromDate", fromDate);
    checkDate("toDate", toDate);
    if (fromDate || toDate) {
      const today = sastTodayMs();
      const start = fromDate ? parseDateMs("fromDate", fromDate) : today - 7 * DAY_MS;
      const end = toDate ? parseDateMs("toDate", toDate) : today;
      const span = Math.round((end - start) / DAY_MS);
      if (span < 0) {
        throw new ValidationError(
          "toDate must not be before fromDate (toDate defaults to today and fromDate to 7 days ago).",
        );
      }
      if (span > 7) {
        throw new ValidationError(
          "Date range too wide: a maximum of 7 days can be queried per call " +
            "(toDate defaults to today and fromDate to 7 days ago).",
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
      throw new ValidationError("date and venue are both required for a race card.");
    }
    checkDate("date", options.date);
    return this.#get("/api/get_horse_racing_results", {
      date: options.date,
      venue: options.venue,
    });
  }

  /** Runner table for a single race. `raceNo` is 1-based. All fields required. */
  async getHorseRacingRace(options: { date: string; venue: string; raceNo: number }): Promise<any> {
    if (!options?.date || !options?.venue || options?.raceNo == null) {
      throw new ValidationError("date, venue and raceNo are all required for a runner table.");
    }
    checkDate("date", options.date);
    return this.#get("/api/get_horse_racing_race", {
      date: options.date,
      venue: options.venue,
      race_no: options.raceNo,
    });
  }

  // --- Number generators ----------------------------------------------

  /**
   * Generate random lines. `lines` is a whole number from 1 to 500 (defaults to
   * 1 server-side); one request costs a single call regardless of `lines`.
   */
  async generateRandomNumbers(options: { game: string; lines?: number }): Promise<any> {
    if (!options?.game) throw new ValidationError("game is required.");
    const lines = options.lines;
    if (
      lines !== undefined &&
      lines !== null &&
      (typeof lines !== "number" || !Number.isInteger(lines) || lines < 1 || lines > 500)
    ) {
      throw new ValidationError(
        `lines must be a whole number from 1 to 500, got ${JSON.stringify(lines)}.`,
      );
    }
    return this.#get("/api/generate_random_numbers", {
      game: options.game,
      lines,
    });
  }

  /**
   * Deterministically turn `text` into lucky numbers. POST: api_key and game
   * are query params, text is in the body.
   */
  async textToLuckyNumbers(options: { game: string; text: string }): Promise<any> {
    if (!options?.game) throw new ValidationError("game is required.");
    if (!options?.text) throw new ValidationError("text is required.");
    return this.#post("/api/text_to_lucky_numbers", {
      params: { game: options.game },
      body: { text: options.text },
    });
  }

  // --- Analysis -------------------------------------------------------

  async getHotColdNumbers(options: { product: string }): Promise<any> {
    if (!options?.product) throw new ValidationError("product is required.");
    return this.#get("/api/get_hot_cold_numbers_stats", { product: options.product });
  }

  async getNumberFrequencies(options: { product: string }): Promise<any> {
    if (!options?.product) throw new ValidationError("product is required.");
    return this.#get("/api/get_number_frequencies", { product: options.product });
  }

  async getNumberPairs(options: { product: string }): Promise<any> {
    if (!options?.product) throw new ValidationError("product is required.");
    return this.#get("/api/get_number_pairs", { product: options.product });
  }

  // --- Checkers (SA games only) ---------------------------------------

  /**
   * Check played lines against a SA draw. Up to 10 lines, costs 1 call.
   * `playedNumbers` is a single line or a list of lines. For Powerball games
   * the last number is the Powerball.
   */
  checkPlayedNumbers(options: {
    game: string;
    date: string;
    playedNumbers: PlayedNumbers;
  }): Promise<any> {
    return this.#check("/api/check_played_numbers", options, 10, false);
  }

  /**
   * Bulk-check up to 500 lines. `playedNumbers` is a list of lines; a single
   * flat line is wrapped into `[line]` for you (the endpoint requires a list of
   * lines).
   *
   * Cost: subscription keys pay 1 call per line (50 lines = 50 calls). Older
   * token-based keys pay 5 tokens per 50 lines or part thereof.
   */
  bulkCheckNumbers(options: {
    game: string;
    date: string;
    playedNumbers: PlayedNumbers;
  }): Promise<any> {
    return this.#check("/api/bulk_check_numbers", options, 500, true);
  }

  async #check(
    path: string,
    options: { game: string; date: string; playedNumbers: PlayedNumbers },
    maxLines: number,
    wrapSingle: boolean,
  ): Promise<any> {
    const { game, date, playedNumbers } = options ?? ({} as typeof options);
    if (!game) throw new ValidationError("game is required (SA games only).");
    if (!date) throw new ValidationError("date is required (YYYY-MM-DD).");
    checkDate("date", date);
    if (!playedNumbers || playedNumbers.length === 0) {
      throw new ValidationError("playedNumbers is required.");
    }
    const lines = asLines(playedNumbers);
    if (lines.length > maxLines) {
      throw new ValidationError(
        `Too many lines: ${lines.length} supplied, but this endpoint accepts at most ${maxLines}.`,
      );
    }
    // The bulk endpoint requires a list of lines, so a flat single line is
    // wrapped into [line]; the 10-line checker accepts either shape as-is.
    return this.#post(path, {
      params: { game, date },
      body: { played_numbers: wrapSingle ? lines : playedNumbers },
    });
  }

  // --- Account --------------------------------------------------------

  /**
   * Remaining calls and subscription status. Free (consumes no calls). The path
   * has no `/api/` prefix and the key rides in the JSON body (the only endpoint
   * that takes it there).
   *
   * Account states are reported, not thrown: a pending, expired or absent
   * subscription comes back in the body, and so does a capped plan that is out
   * of credits (HTTP 403 with `status: "error"` plus the usage fields). An
   * unknown key (HTTP 404) throws AuthError.
   *
   * Fields vary by billing model. For subscription keys they include
   * `subscription_status` (the raw status, e.g. "active", "pending", "expired",
   * "cancelled", or "none" when no plan has been chosen), `subscription_state`
   * (derived: "active", "cancelling", "expired", "invoice_cancelled" or
   * "none"), `subscription_period_months`, `tier`, `monthly_limit`, `used`,
   * `remaining`, `subscription_end`, `days_until_expiry` and `usage_breakdown`
   * (per-key usage when the account has sub-keys). A key with no API plan gets
   * `push_subscription` (the active Webhook Push subscription, or null) instead.
   */
  async checkBalance(): Promise<any> {
    try {
      return await this.#post("/check_api_key_balance", {
        apiKeyInBody: true,
        raiseOnErrorBody: false,
        reportStatuses: [403],
      });
    } catch (err) {
      if (err instanceof APIError && err.constructor === APIError && err.statusCode === 404) {
        throw new AuthError(err.message, err.statusCode, err.response);
      }
      throw err;
    }
  }
}

/** Pick the AuthError subclass that fits a 401/403 message. */
function classifyAuth(message: string): typeof AuthError {
  const text = message.trim().toLowerCase();
  if (text.includes("subscription has expired") || text === "api key expired") {
    return SubscriptionExpiredError;
  }
  if (text.includes("subscription is pending") || text.includes("pending payment")) {
    return SubscriptionPendingError;
  }
  if (text.includes("subscription is not active")) return SubscriptionError;
  if (QUOTA_MESSAGES.some((phrase) => text.includes(phrase))) return QuotaExceededError;
  return AuthError;
}

/**
 * Return `value` as a UTC-midnight timestamp, or throw ValidationError unless
 * it is a strict YYYY-MM-DD string naming a real calendar day.
 */
function parseDateMs(name: string, value: unknown): number {
  if (typeof value !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
    throw new ValidationError(`${name} must be a 'YYYY-MM-DD' string, got ${JSON.stringify(value)}.`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (
    year < 1 ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError(`${name} is not a real calendar date: ${JSON.stringify(value)}.`);
  }
  return ms;
}

/** Validate an optional date; undefined, null or "" means "not given". */
function checkDate(name: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  parseDateMs(name, value);
}

/** Today's date in South Africa (the API's default for date ranges), as UTC midnight. */
function sastTodayMs(): number {
  const now = new Date(Date.now() + SAST_OFFSET_MS);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Normalise playedNumbers to a list of lines. A list of arrays is N lines; a
 * flat list of numbers is a single line. A mix is rejected (the server would
 * answer HTTP 400).
 */
function asLines(playedNumbers: PlayedNumbers): number[][] {
  const items = playedNumbers as unknown[];
  const isLine = items.map((item) => Array.isArray(item));
  if (isLine.every(Boolean)) return items as number[][];
  if (!isLine.some(Boolean)) return [items as number[]];
  throw new ValidationError(
    "playedNumbers must be one line of numbers or a list of lines, not a mix.",
  );
}
