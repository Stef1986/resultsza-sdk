/**
 * Typed errors so integrators can branch on failure kinds instead of parsing
 * raw response bodies. No error message ever contains the API key.
 *
 * Hierarchy:
 *
 *   ResultsZAError
 *   ├── APIError
 *   │   ├── BadRequestError
 *   │   │   └── ValidationError          (thrown client-side, before any request)
 *   │   ├── AuthError
 *   │   │   ├── QuotaExceededError
 *   │   │   └── SubscriptionError
 *   │   │       ├── SubscriptionExpiredError
 *   │   │       └── SubscriptionPendingError
 *   │   └── RateLimitError
 *   └── InvalidSignatureError
 */
export class ResultsZAError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The API returned an error response. */
export class APIError extends ResultsZAError {
  readonly statusCode: number | undefined;
  readonly response: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.response = response;
  }
}

/** Invalid parameters (usually HTTP 400). */
export class BadRequestError extends APIError {}

/**
 * Invalid parameters caught client-side, before any HTTP request is made (it
 * is the same kind of problem the server would answer with HTTP 400).
 * `statusCode` is undefined because no request was sent.
 */
export class ValidationError extends BadRequestError {}

/**
 * The API refused the key (HTTP 401): missing, invalid, deactivated, or an
 * account problem. The more specific subclasses say which; anything not
 * recognised stays a plain AuthError.
 */
export class AuthError extends APIError {}

/**
 * The key is valid but has no calls left: monthly allowance used up, tokens
 * exhausted, or the free daily quota reached. Buy a top-up or upgrade, or wait
 * for the allowance to reset.
 */
export class QuotaExceededError extends AuthError {}

/** Headers accepted by RateLimitError: a fetch `Headers` object or a plain record. */
export type HeadersLike = Headers | Record<string, string | undefined>;

/**
 * Rate limit hit (HTTP 429). The Unlimited tier allows 60 req/min; exceeding it
 * triggers a 5-minute cooldown, so back off rather than retrying immediately.
 *
 * Extra fields (undefined when the server did not send them): `retryAfter`
 * (seconds to wait), `cooldown` (true during the 5-minute cooldown),
 * `cooldownRemaining` (seconds of cooldown left), and `limit` / `remaining` /
 * `reset` from the `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
 * `X-RateLimit-Reset` response headers (`reset` is a Unix timestamp).
 */
export class RateLimitError extends APIError {
  readonly retryAfter: number | undefined;
  readonly cooldown: boolean;
  readonly cooldownRemaining: number | undefined;
  readonly limit: number | undefined;
  readonly remaining: number | undefined;
  readonly reset: number | undefined;

  constructor(message: string, statusCode?: number, response?: unknown, headers?: HeadersLike) {
    super(message, statusCode, response);
    const body =
      response && typeof response === "object" ? (response as Record<string, unknown>) : {};
    const header = (name: string): string | undefined => readHeader(headers, name);

    this.retryAfter = toInt(body.retry_after) ?? toInt(header("retry-after"));
    this.cooldown = body.cooldown === true || header("x-ratelimit-cooldown") !== undefined;
    this.cooldownRemaining =
      toInt(body.cooldown_remaining) ?? toInt(header("x-ratelimit-cooldown"));
    this.limit = toInt(header("x-ratelimit-limit"));
    this.remaining = toInt(header("x-ratelimit-remaining"));
    this.reset = toInt(header("x-ratelimit-reset"));
  }
}

/**
 * The subscription is not in an active state. A subclass of AuthError, because
 * the API answers these with HTTP 401.
 */
export class SubscriptionError extends AuthError {}

/** Subscription (or the key itself) has expired; the key is deactivated until renewed. */
export class SubscriptionExpiredError extends SubscriptionError {}

/**
 * Subscription payment is pending; the key is not yet active.
 *
 * Reserved: the data endpoints currently report an unpaid subscription as
 * "Subscription is not active", which throws the base SubscriptionError.
 * checkBalance() reports a pending subscription in its response body
 * (`subscription_status: "pending"`) instead of throwing.
 */
export class SubscriptionPendingError extends SubscriptionError {}

/** A webhook payload's signature did not match the expected HMAC. */
export class InvalidSignatureError extends ResultsZAError {}

function readHeader(headers: HeadersLike | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers as Record<string, string | undefined>)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined || typeof value === "boolean") return undefined;
  if (typeof value === "string" && !/^\s*-?\d+\s*$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}
