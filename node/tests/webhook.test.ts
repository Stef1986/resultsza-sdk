import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { InvalidSignatureError } from "../src/index";
import { parseEvent, verifyAndParse, verifyWebhookSignature } from "../src/index";

const SECRET = "ephemeral-test-secret";

function sign(rawBody: string | Buffer, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("signature verification", () => {
  it("accepts a valid signature", () => {
    const body = '{"event":"result.published","game":"lotto"}';
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = '{"event":"result.published","game":"lotto"}';
    const sig = sign(body);
    const tampered = '{"event":"result.published","game":"powerball"}';
    expect(verifyWebhookSignature(tampered, sig, SECRET)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const body = '{"n":1}';
    expect(verifyWebhookSignature(body, sign(body, "different-secret"), SECRET)).toBe(false);
  });

  it("requires the sha256= prefix", () => {
    const body = '{"n":1}';
    const bareHex = createHmac("sha256", SECRET).update(body).digest("hex");
    expect(verifyWebhookSignature(body, bareHex, SECRET)).toBe(false);
  });

  it("returns false for a missing header", () => {
    expect(verifyWebhookSignature("{}", "", SECRET)).toBe(false);
    expect(verifyWebhookSignature("{}", undefined, SECRET)).toBe(false);
  });

  it("accepts a Buffer body", () => {
    const body = Buffer.from('{"n":1}');
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });
});

describe("envelope parsing", () => {
  it("extracts the envelope fields", () => {
    const payload = {
      event: "result.published",
      game: "lotto",
      country: "ZA",
      dispatched_at: "2026-06-25T21:05:00Z",
      data: { draw_number: 1234 },
    };
    const ev = parseEvent(JSON.stringify(payload));
    expect(ev.event).toBe("result.published");
    expect(ev.game).toBe("lotto");
    expect(ev.country).toBe("ZA");
    expect(ev.dispatchedAt).toBe("2026-06-25T21:05:00Z");
    expect(ev.data.draw_number).toBe(1234);
    expect(ev.isTest).toBe(false);
  });

  it("flags a test event", () => {
    const ev = parseEvent(JSON.stringify({ event: "result.test", game: "lotto", data: {} }));
    expect(ev.isTest).toBe(true);
  });

  it("exposes headers", () => {
    const ev = parseEvent(JSON.stringify({ event: "result.published", game: "lotto", data: {} }), {
      "X-ResultsZA-Game": "lotto",
    });
    expect(ev.headers["X-ResultsZA-Game"]).toBe("lotto");
  });

  it("builds a dedupe key from game + draw_number", () => {
    const ev = parseEvent(
      JSON.stringify({ event: "result.published", game: "lotto", data: { draw_number: 2500 } }),
    );
    expect(ev.dedupeKey()).toBe("lotto:2500");
  });

  it("falls back to date and time for the dedupe key", () => {
    const ev = parseEvent(
      JSON.stringify({
        event: "result.published",
        game: "PREMIER PEOPLES",
        data: { draw_date: "2026-06-25", draw_time: "14:00" },
      }),
    );
    expect(ev.dedupeKey()).toBe("PREMIER PEOPLES:2026-06-25:14:00");
  });
});

describe("verifyAndParse", () => {
  it("returns the event when the signature is valid", () => {
    const body = JSON.stringify({ event: "result.published", game: "lotto", data: {} });
    const ev = verifyAndParse(body, sign(body), SECRET);
    expect(ev.game).toBe("lotto");
  });

  it("throws InvalidSignatureError on a bad signature", () => {
    const body = JSON.stringify({ event: "result.published" });
    expect(() => verifyAndParse(body, "sha256=deadbeef", SECRET)).toThrowError(
      InvalidSignatureError,
    );
  });
});
