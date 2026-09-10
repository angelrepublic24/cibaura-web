import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { STRIPE_PUBLISHABLE_KEY } from "@/lib/config";

/**
 * Lazily-loaded Stripe.js singleton. The publishable key is safe to expose
 * (`NEXT_PUBLIC_*`); the card number is tokenized IN THE BROWSER by Stripe
 * Elements and never touches our servers (invariant #3) — we only ever send
 * the resulting `pm_...` token to the backend.
 *
 * Key validation is fail-loud at build time (see `lib/config.ts`): a
 * production bundle can't ship without a valid publishable key. In
 * development the key may be absent, in which case `getStripe()` resolves
 * `null` and the card UI renders its "not configured" state.
 */
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = STRIPE_PUBLISHABLE_KEY
      ? loadStripe(STRIPE_PUBLISHABLE_KEY)
      : Promise.resolve(null);
  }
  return stripePromise;
}

export const stripeConfigured = Boolean(STRIPE_PUBLISHABLE_KEY);

/**
 * True when the key is a Stripe TEST key — the add-card form shows the
 * "use 4242…" helper only then; a live key never renders test-card copy.
 */
export const stripeTestMode = (STRIPE_PUBLISHABLE_KEY ?? "").startsWith(
  "pk_test_",
);
