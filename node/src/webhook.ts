/**
 * Helpers for receiving ResultsZA webhooks: verify the signature and parse the
 * event envelope. There is no webhook-management API (endpoints and secrets are
 * configured in the portal's Push Settings), so this is receive-side only.
 *
 * Verify over the raw request bytes with HMAC-SHA256 and a constant-time
 * compare. Always pass the exact bytes you received: hashing a re-serialized
 * copy of the JSON will not match.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { InvalidSignatureError } from "./errors";

/** Headers ResultsZA sends with every delivery. */
export const SIGNATURE_HEADER = "X-ResultsZA-Signature";
export const EVENT_HEADER = "X-ResultsZA-Event";
export const GAME_HEADER = "X-ResultsZA-Game";

export type RawBody = string | Buffer | Uint8Array;
export type WebhookHeaders = Record<string, string | undefined>;

/** Return the `sha256=<hex>` signature for `rawBody` under `secret`. */
export function computeSignature(rawBody: RawBody, secret: string): string {
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${hex}`;
}

/**
 * Return true iff `signatureHeader` matches the HMAC of `rawBody`.
 *
 * `rawBody` must be the exact bytes received. `signatureHeader` is the
 * `X-ResultsZA-Signature` value, including its `sha256=` prefix. The comparison
 * is constant-time.
 */
export function verifyWebhookSignature(
  rawBody: RawBody,
  signatureHeader: string | undefined | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = Buffer.from(computeSignature(rawBody, secret));
  const provided = Buffer.from(signatureHeader);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** A parsed webhook envelope. */
export class WebhookEvent {
  readonly payload: Record<string, any>;
  readonly headers: WebhookHeaders;
  readonly event: string | undefined;
  readonly game: string | undefined;
  readonly country: string | undefined;
  readonly dispatchedAt: string | undefined;
  readonly data: Record<string, any>;

  constructor(payload: Record<string, any>, headers: WebhookHeaders = {}) {
    this.payload = payload;
    this.headers = headers;
    this.event = payload.event;
    this.game = payload.game;
    this.country = payload.country;
    this.dispatchedAt = payload.dispatched_at;
    this.data = payload.data ?? {};
  }

  /**
   * True for portal test sends (`result.test`). Handle or ignore these so test
   * traffic does not enter your live pipeline.
   */
  get isTest(): boolean {
    return this.event === "result.test";
  }

  /**
   * Best-effort key for deduplicating at-least-once deliveries. Combines the
   * game with the most specific draw identifier present. Confirm it fits the
   * games you subscribe to before relying on it.
   */
  dedupeKey(): string {
    const parts: string[] = [this.game ?? ""];
    const data = this.data;
    if (data.draw_number != null) {
      parts.push(String(data.draw_number));
    } else if (data.draw_id != null) {
      parts.push(String(data.draw_id));
    } else {
      for (const key of ["draw_date", "date", "draw_time"]) {
        if (data[key] != null) parts.push(String(data[key]));
      }
    }
    return parts.join(":");
  }
}

function toText(rawBody: RawBody): string {
  return typeof rawBody === "string" ? rawBody : Buffer.from(rawBody).toString("utf-8");
}

/**
 * Parse a webhook payload into a WebhookEvent. Does not verify the signature;
 * call verifyWebhookSignature or verifyAndParse for that.
 */
export function parseEvent(rawBody: RawBody, headers: WebhookHeaders = {}): WebhookEvent {
  const payload = JSON.parse(toText(rawBody));
  return new WebhookEvent(payload, headers);
}

/**
 * Verify the signature and return the parsed WebhookEvent. Throws
 * InvalidSignatureError if the signature does not match, so do this before
 * trusting any payload contents.
 */
export function verifyAndParse(
  rawBody: RawBody,
  signatureHeader: string | undefined | null,
  secret: string,
  headers: WebhookHeaders = {},
): WebhookEvent {
  if (!verifyWebhookSignature(rawBody, signatureHeader, secret)) {
    throw new InvalidSignatureError("Webhook signature verification failed.");
  }
  return parseEvent(rawBody, headers);
}
