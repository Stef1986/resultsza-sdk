/**
 * A minimal, correct ResultsZA webhook receiver using Express.
 *
 *   RESULTSZA_WEBHOOK_SECRET=your_secret npx tsx examples/webhookReceiverExpress.ts
 *
 * The secret is the value from your portal Push Settings. It is read from the
 * environment - never hardcode it. Register your public HTTPS URL and send a
 * test delivery from Push Settings once this is running behind HTTPS.
 *
 * The four things receivers get wrong, handled below:
 *   1. Verify against the RAW request bytes, not re-serialized JSON.
 *   2. Return 2xx within 10 seconds; do slow work afterwards.
 *   3. Deduplicate - delivery is at-least-once and unordered.
 *   4. Handle result.test so portal test sends don't hit your live pipeline.
 */
import express from "express";

// In your project: import { verifyAndParse, InvalidSignatureError, SIGNATURE_HEADER } from "resultsza-sdk";
import { InvalidSignatureError, SIGNATURE_HEADER, verifyAndParse } from "../src/index";

const app = express();
const SECRET = process.env.RESULTSZA_WEBHOOK_SECRET!;

// Swap this in-memory set for a durable store (Redis, a DB, etc.) in production.
const seenKeys = new Set<string>();

// express.raw() preserves the exact bytes needed for signature verification.
// Do NOT use express.json() here - it discards the raw body you must hash.
app.post("/webhooks/resultsza", express.raw({ type: "*/*" }), (req, res) => {
  const signature = req.header(SIGNATURE_HEADER) ?? "";

  let event;
  try {
    event = verifyAndParse(req.body as Buffer, signature, SECRET);
  } catch (err) {
    if (err instanceof InvalidSignatureError) {
      res.status(401).end();
      return;
    }
    throw err;
  }

  // Portal test sends - acknowledge but don't process.
  if (event.isTest) {
    res.status(204).end();
    return;
  }

  // Deduplicate at-least-once deliveries.
  const key = event.dedupeKey();
  if (seenKeys.has(key)) {
    res.status(200).end();
    return;
  }
  seenKeys.add(key);

  // Return quickly, THEN do the slow work (queue a job, write to a DB, etc.).
  // enqueueProcessing(event.game, event.data);

  res.status(200).end();
});

// Behind a real HTTPS terminator in production - plain HTTP is rejected by
// ResultsZA. This dev server is for local testing only.
app.listen(8000, () => console.log("listening on :8000"));
