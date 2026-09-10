/**
 * Resolved backend API base URL.
 *
 * `NEXT_PUBLIC_API_URL` is inlined at build time. In development we fall
 * back to localhost (convenient), but a PRODUCTION build with the env
 * missing throws at module-eval, which fails `next build` LOUDLY instead
 * of shipping a bundle that points every real user at localhost.
 * (Pattern mirrored from Beusun `src/lib/config.ts`.)
 *
 * The NestJS backend mounts every route under the global prefix `api/`
 * (see backend `main.ts` → `setGlobalPrefix('api/')`), so the resolved base
 * URL always ends in `/api`. Feature modules call bare paths (`/auth/login`)
 * and this prefix makes them resolve to `…/api/auth/login`.
 *
 * DEPLOYMENT (ADR-0006): the session rides in httpOnly `SameSite=Lax`
 * cookies, so the API MUST live under the same registrable domain as this
 * site (`cibaura.com` + `api.cibaura.com`). See next.config.ts + README.
 */
function resolveApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url && url.trim().length > 0) return withApiPrefix(url);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[config] NEXT_PUBLIC_API_URL is required for production builds. " +
        "Set it in the build environment (e.g. https://api.cibaura.example).",
    );
  }

  return withApiPrefix("http://localhost:4300");
}

/** Strip trailing slashes and ensure a single `/api` suffix (idempotent). */
function withApiPrefix(url: string): string {
  const base = url.trim().replace(/\/+$/, "");
  return /\/api$/.test(base) ? base : `${base}/api`;
}

export const API_URL = resolveApiUrl();

/**
 * Stripe PUBLISHABLE key (`pk_test_…` / `pk_live_…`) — safe to inline, the
 * PAN is tokenized by Stripe Elements in the browser and never reaches us.
 *
 * Fail-loud policy (mirrors `resolveApiUrl`):
 *  - production build + key missing            → throw (no silent "Add card
 *    disabled" in prod: customers could never book).
 *  - production build + `pk_test_` key          → throw unless
 *    `NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY=true` (staging only).
 *  - any build + a value that is not `pk_…`     → throw (a secret key or a
 *    typo must never ship).
 *  - development + key missing                  → `undefined`; the card UI
 *    renders an explicit "payments are not configured" state.
 */
function resolveStripePublishableKey(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const isProduction = process.env.NODE_ENV === "production";

  if (!raw) {
    if (isProduction) {
      throw new Error(
        "[config] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required for " +
          "production builds — without it customers cannot save a card or book.",
      );
    }
    return undefined;
  }

  if (!raw.startsWith("pk_")) {
    throw new Error(
      "[config] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a Stripe " +
        "PUBLISHABLE key (pk_test_… / pk_live_…). Never inline a secret key.",
    );
  }

  const allowTest = process.env.NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY === "true";
  if (isProduction && raw.startsWith("pk_test_") && !allowTest) {
    throw new Error(
      "[config] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a TEST key in a " +
        "production build. Use the live key, or set " +
        "NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY=true for a staging build.",
    );
  }

  return raw;
}

export const STRIPE_PUBLISHABLE_KEY = resolveStripePublishableKey();
