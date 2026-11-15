import type { PaymentMethod, Quote } from "@/shared/types/domain";
import type { QuoteInput } from "../types/bookings.types";

export interface CheckoutContext {
  input: QuoteInput;
  userId: string | null;
  card: PaymentMethod | null;
  legalVersion: string | null;
  materialIdentity: string;
}
export interface CheckoutSnapshot {
  input: Readonly<QuoteInput>;
  quote: Readonly<Quote>;
  card: Readonly<PaymentMethod>;
  userId: string;
  termsVersion: string;
  contextKey: string;
}

export function checkoutContextKey(context: CheckoutContext): string {
  const input = context.input;
  return JSON.stringify([
    context.userId,
    context.card?.id ?? null,
    context.legalVersion,
    context.materialIdentity,
    input.carId,
    input.start,
    input.end,
    input.pickupType ?? "branch_pickup",
    input.deliveryZoneId ?? null,
    input.deliveryAddress ?? null,
    input.deliveryLat ?? null,
    input.deliveryLng ?? null,
    input.deliveryCityName ?? null,
    input.deliveryReference ?? null,
  ]);
}
export function unexpired(expiresAt: string, now = Date.now()): boolean {
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > now;
}
export function freezeCheckout(
  context: CheckoutContext,
  quote: Quote,
  acceptedVersion: string,
  now = Date.now(),
): CheckoutSnapshot | null {
  if (
    !context.userId ||
    !context.card ||
    !context.legalVersion ||
    acceptedVersion !== context.legalVersion ||
    !quote.token ||
    !unexpired(quote.expiresAt, now)
  )
    return null;
  return Object.freeze({
    input: Object.freeze({ ...context.input }),
    quote: Object.freeze({
      ...quote,
      pricing: Object.freeze({ ...quote.pricing }),
    }),
    card: Object.freeze({ ...context.card }),
    userId: context.userId,
    termsVersion: acceptedVersion,
    contextKey: checkoutContextKey(context),
  });
}

/** A POST may already have committed. Never turn this into a new automatic request. */
export class BookingOutcomeUnknownError extends Error {
  readonly bookingId: string | null;
  constructor(bookingId?: unknown) {
    super(
      "We could not confirm the result of your request. Check your rentals and payment status before submitting another request.",
    );
    this.name = "BookingOutcomeUnknownError";
    this.bookingId =
      typeof bookingId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        bookingId,
      )
        ? bookingId
        : null;
  }
}
