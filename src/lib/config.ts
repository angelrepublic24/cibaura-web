import { publicUrl, requiredPublicUrl } from "./public-url";

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
const production = process.env.NODE_ENV === "production";
const configuredApi = requiredPublicUrl(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:4300",
  production,
);
const apiPath = configuredApi.pathname.replace(/\/+$/, "");
configuredApi.pathname = apiPath.endsWith("/api") ? apiPath : `${apiPath}/api`;
export const API_URL = configuredApi.href.replace(/\/+$/, "");

export const SITE_URL = requiredPublicUrl(
  "NEXT_PUBLIC_SITE_URL",
  process.env.NEXT_PUBLIC_SITE_URL,
  "http://localhost:3000",
  production,
);
if (SITE_URL.pathname !== "/")
  throw new Error(
    "[config] NEXT_PUBLIC_SITE_URL must be an origin without a path.",
  );

/** Optional public CDN base/prefix for legacy car photos and agency logos. */
export const MEDIA_URL = publicUrl(
  "NEXT_PUBLIC_MEDIA_URL",
  process.env.NEXT_PUBLIC_MEDIA_URL,
  undefined,
  production,
);
if (MEDIA_URL && !MEDIA_URL.pathname.endsWith("/")) MEDIA_URL.pathname += "/";

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

  if (
    !/^pk_(test|live)_[a-zA-Z0-9]+$/.test(raw) ||
    /replace|placeholder|changeme/i.test(raw)
  ) {
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

const legalValues = [
  process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME,
  process.env.NEXT_PUBLIC_LEGAL_RNC,
  process.env.NEXT_PUBLIC_LEGAL_ADDRESS,
  process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL,
];
export const LEGAL_CONFIGURED = legalValues.every((value) =>
  Boolean(value?.trim()),
);
export const MAPS_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim(),
);
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA?.trim() || null;
/** Build-only policy: exception flags are never required at browser/runtime startup. */
export function assertRequiredFeatures(
  allowDefaultLegal: boolean,
  allowMissingMaps: boolean,
): void {
  if (!LEGAL_CONFIGURED && !allowDefaultLegal)
    throw new Error(
      "[config] All four NEXT_PUBLIC_LEGAL_* values are required; ALLOW_DEFAULT_LEGAL=true is an explicit non-release exception.",
    );
  if (!MAPS_CONFIGURED && !allowMissingMaps)
    throw new Error(
      "[config] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required; ALLOW_MISSING_MAPS=true is an explicit non-release exception.",
    );
}
if (production) {
  if (!BUILD_SHA || !/^[a-f0-9]{40}$/i.test(BUILD_SHA))
    throw new Error(
      "[config] NEXT_PUBLIC_BUILD_SHA must be the full 40-hex commit SHA.",
    );
}
