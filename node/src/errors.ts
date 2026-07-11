/**
 * Typed errors so integrators can branch on failure kinds instead of parsing
 * raw response bodies. No error message ever contains the API key.
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

/** The API key is missing, invalid, or deactivated. */
export class AuthError extends APIError {}

/**
 * Rate limit hit. The Unlimited tier allows 60 req/min; exceeding it triggers a
 * 5-minute cooldown, so back off rather than retrying immediately.
 */
export class RateLimitError extends APIError {}

/** The subscription is not in an active state. */
export class SubscriptionError extends APIError {}

/** Subscription has expired; the key is deactivated until renewed. */
export class SubscriptionExpiredError extends SubscriptionError {}

/** Subscription payment is pending; the key is not yet active. */
export class SubscriptionPendingError extends SubscriptionError {}

/** A webhook payload's signature did not match the expected HMAC. */
export class InvalidSignatureError extends ResultsZAError {}
