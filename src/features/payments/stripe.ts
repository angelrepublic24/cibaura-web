import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Lazily-loaded Stripe.js singleton. The publishable key is safe to expose
 * (`NEXT_PUBLIC_*`); the card number is tokenized IN THE BROWSER by Stripe
 * Elements and never touches our servers (invariant #3) — we only ever send
 * the resulting `pm_...` token to the backend.
 */
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

export const stripeConfigured = Boolean(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);
