#!/usr/bin/env node
/**
 * DOES STRIPE STILL RECOGNIZE OUR PUBLISHABLE KEY?
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * On 2026-10-23 nobody in production could save a card. Stripe.js answered
 * every attempt with
 *
 *     Invalid API Key provided: pk_live_***…ELMw
 *
 * The key was well formed, it was a `pk_live_`, it passed every check this
 * repo had — and Stripe had stopped recognizing it, because the account was
 * switched and the old account's key was rolled while the web kept the one
 * baked into its build.
 *
 * `check-release-stripe.mjs` could not have caught that and should not try:
 * it runs offline, on synthetic values, and asks whether the key is the
 * RIGHT SHAPE. This asks the only question that shape cannot answer — does
 * the key still exist — and so it needs the network and a real key.
 *
 * That is why it is NOT part of `npm run smoke`. Smokes stay hermetic. This
 * is a PREFLIGHT: run it against the environment you are about to deploy,
 * with that environment's key.
 *
 *     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_… node scripts/check-stripe-key-live.mjs
 *
 * ── HOW IT ASKS ───────────────────────────────────────────────────────────
 *
 * By READING a token that does not exist. A publishable key is meant to be
 * used from a browser, so authenticating with it is ordinary; fetching a
 * made-up id creates nothing, charges nothing and leaves no record.
 *
 * Stripe answers 401 when it does not know the key, and 404 (`no such
 * token`) when it does. So 401 is the single failure, and EVERY other
 * answer means the key authenticated — which keeps this honest if Stripe
 * ever changes the body of that 404.
 */

const PROBE_URL = "https://api.stripe.com/v1/tokens/tok_this_token_never_existed";
const TIMEOUT_MS = 10_000;

function fail(message) {
  console.error(`check:stripe-key-live: ${message}`);
  process.exit(1);
}

const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();

if (!key) {
  fail(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Run this with the key of " +
      "the environment you are about to deploy.",
  );
}

if (!/^pk_(test|live)_[a-zA-Z0-9]+$/.test(key)) {
  fail(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not a Stripe publishable key. " +
      "Never pass a secret key to this script — it leaves the machine.",
  );
}

/** `pk_live_…ELMw` — enough to tell two keys apart, never the whole key. */
const shortened = `${key.slice(0, 8)}…${key.slice(-4)}`;

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

let response;
try {
  response = await fetch(PROBE_URL, {
    headers: { Authorization: `Bearer ${key}` },
    signal: controller.signal,
  });
} catch (err) {
  // A network failure is NOT a dead key, and must not read as one: the
  // deploy should be stopped for a reason the operator can act on.
  fail(
    `could not reach Stripe to check ${shortened} ` +
      `(${err instanceof Error ? err.message : String(err)}). ` +
      "This says nothing about the key — check connectivity and re-run.",
  );
} finally {
  clearTimeout(timer);
}

if (response.status === 401) {
  fail(
    `Stripe does not recognize ${shortened}.\n` +
      "  The key was rolled, deleted, or belongs to an account you no longer " +
      "use.\n" +
      "  Deploying this build means nobody can save a card or pay.\n" +
      "  Take the publishable key from the SAME Stripe account whose secret " +
      "key the backend uses, and rebuild — this value is baked in at build " +
      "time, not read at runtime.",
  );
}

console.log(
  `check:stripe-key-live: OK — Stripe recognizes ${shortened} ` +
    `(probe answered ${response.status}).`,
);
