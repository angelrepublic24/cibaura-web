import { z } from "zod";
import {
  CLAIM_STATUSES,
  DEPOSIT_STATUSES,
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  MEDIA_KINDS,
  MEDIA_LABELS,
  SETTLEMENT_CASES,
} from "@/shared/types/domain";
import { namedRefWireSchema } from "@/shared/api/wire";

/**
 * Booking wire schemas (zod v4) — the customer side of a booking's whole
 * life: the server quote, the request, the detail with its agreement,
 * deposit, inspections, claim and settlement, plus the per-booking chat.
 *
 * `BookingsService` validates every response against these. Money is NEVER
 * derived on the client: every `*Cents` here is rendered verbatim.
 *
 * The `z.infer` types live in `../types/bookings.types`.
 */

// ---------------------------------------------------------------- enums

export const bookingStateSchema = z.enum([
  "requested",
  "accepted",
  "active",
  "returned",
  "settled",
  "rejected",
  "expired",
  "cancelled",
]);

export const pickupTypeSchema = z.enum(["branch_pickup", "delivery"]);
export const bookingPaymentStatusSchema = z.enum([
  "authorized",
  "requires_action",
  "failed",
]);
export const paymentLifecycleStatusSchema = z.enum([
  "authorized",
  "requires_action",
  "failed",
  "captured",
  "voided",
  "refunded",
  "capture_failed",
]);
export const depositStatusSchema = z.enum(DEPOSIT_STATUSES);
export const inspectionTypeSchema = z.enum(INSPECTION_TYPES);
export const inspectionStatusSchema = z.enum(INSPECTION_STATUSES);
export const mediaKindSchema = z.enum(MEDIA_KINDS);
export const mediaLabelSchema = z.enum(MEDIA_LABELS);
export const claimStatusSchema = z.enum(CLAIM_STATUSES);
export const settlementCaseSchema = z.enum(SETTLEMENT_CASES);

// ------------------------------------------------------------ the booking

/**
 * Server-computed money. `host*` figures are HOST/ADMIN only; a renter's
 * screen reads the `renter*` pair and `totalCents`.
 */
export const pricingWireSchema = z.object({
  days: z.number(),
  hostDailyRateCents: z.number(),
  renterDailyRateCents: z.number(),
  hostDeliveryFeeCents: z.number(),
  renterDeliveryFeeCents: z.number(),
  hostSubtotalCents: z.number(),
  renterSubtotalCents: z.number(),
  commissionPct: z.number(),
  commissionCents: z.number(),
  taxCents: z.number(),
  taxRatePct: z.number(),
  totalCents: z.number(),
  currency: z.string(),
});

/** `deliveryFeeCents` is always present (0 for a branch pickup). */
export const bookingPickupWireSchema = z.object({
  type: pickupTypeSchema,
  deliveryZoneId: z.string().optional(),
  deliveryZoneName: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryReference: z.string().optional(),
  deliveryDistanceKm: z.number().optional(),
  deliveryFeeCents: z.number(),
  /** Branch's exact address — present only once paid AND branch pickup. */
  branchAddress: z.string().optional(),
  branchPhone: z.string().optional(),
  branchHours: z.record(z.string(), z.string()).optional(),
});

/**
 * Renter identity for the AGENCY/ADMIN viewer. Contact details are exposed
 * only while the booking is `accepted | active | returned` (ADR-0011
 * identity exposure) and are OMITTED — undefined, never null — outside
 * those states. The name is always present.
 */
export const bookingCustomerWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().nullish(),
});

export const bookingAgreementRenterWireSchema = z.object({
  fullName: z.string(),
  /** OMITTED for an agency viewer outside `accepted | active | returned`. */
  licenseMasked: z.string().optional(),
  licenseExpiry: z.string().nullish(),
});

export const bookingAgreementDocumentWireSchema = z.object({
  id: z.string(),
  templateVersion: z.number(),
  status: z.string(),
  signedAt: z.string(),
  countersignedAt: z.string().nullable(),
});

export const bookingAgreementWireSchema = z.object({
  termsVersion: z.string(),
  acceptedAt: z.string(),
  renter: bookingAgreementRenterWireSchema,
  car: z.object({ plate: z.string().nullable() }),
  agencyConditions: z.string().nullable(),
  /** The signed rental-agreement document (ADR-0010); null for walk-ins. */
  document: bookingAgreementDocumentWireSchema.nullable(),
});

export const depositWireSchema = z.object({
  amountCents: z.number(),
  currency: z.string(),
  status: depositStatusSchema,
  captureBefore: z.string().nullable(),
  capturedCents: z.number(),
  /** Owning customer only, while `requires_action` (resume 3DS). */
  clientSecret: z.string().nullish(),
});

export const inspectionMediaWireSchema = z.object({
  id: z.string(),
  kind: mediaKindSchema,
  label: mediaLabelSchema,
  status: z.string(),
  /** Signed URL (parties + admin only); null until uploaded. */
  url: z.string().nullable(),
  expiresAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  position: z.number(),
});

export const inspectionWireSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  type: inspectionTypeSchema,
  status: inspectionStatusSchema,
  odometerKm: z.number().nullable(),
  fuelLevelEighths: z.number().nullable(),
  damageNotes: z.string().nullable(),
  damageFlagged: z.boolean(),
  media: z.array(inspectionMediaWireSchema),
  submittedAt: z.string().nullable(),
  customerConfirmedAt: z.string().nullable(),
  customerAbsentReason: z.string().nullable(),
  customerDisputeNote: z.string().nullable(),
  finalizedAt: z.string().nullable(),
});

export const claimWireSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  currency: z.string(),
  status: claimStatusSchema,
  requestedCents: z.number(),
  approvedCents: z.number().nullable(),
  capturedCents: z.number(),
  uncollectedCents: z.number(),
  description: z.string(),
  evidenceMediaIds: z.array(z.string()),
  customerResponse: z.string().nullable(),
  customerNote: z.string().nullable(),
  respondBy: z.string(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
});

export const settlementLineWireSchema = z.object({
  code: z.string(),
  label: z.string(),
  amountCents: z.number(),
});

export const settlementWireSchema = z.object({
  status: z.string(),
  case: settlementCaseSchema,
  refundCents: z.number(),
  retentionCents: z.number(),
  earlyReturnRefundCents: z.number(),
  unusedDays: z.number(),
  claimCents: z.number(),
  advanceCents: z.number(),
  hostNetCents: z.number(),
  platformNetCents: z.number(),
  /** Tax allocated to the tax authority, outside both net amounts. */
  taxCents: z.number(),
  breakdown: z.array(settlementLineWireSchema),
  disputeWindowEndsAt: z.string().nullable(),
  finalizedAt: z.string().nullable(),
});

/** The hand-over code step: the renter sees the digits, the agency never does. */
export const bookingHandoverWireSchema = z.object({
  /** The digits — the renter only. Null for the agency, admin, and walk-ins. */
  code: z.string().nullable(),
  /** Whether this booking needs the code before pick-up can be recorded. */
  codeRequired: z.boolean(),
  /** ISO instant the agency entered the right code; null until then. */
  confirmedAt: z.string().nullable(),
});

/**
 * Agency/admin viewers only. `reasons` stays `z.string()` on purpose: a code
 * the backend adds later must read as "something else is missing", not blank
 * the whole booking at parse time.
 */
export const renterDocumentsWireSchema = z.object({
  pending: z.boolean(),
  reasons: z.array(z.string()),
  lastRemindedAt: z.string().nullable(),
  nextReminderAt: z.string().nullable(),
});

export const bookingWireSchema = z.object({
  id: z.string(),
  car: z.object({
    id: z.string(),
    make: z.string(),
    model: z.string(),
    year: z.number(),
    primaryPhoto: z.string().nullable(),
  }),
  branch: namedRefWireSchema,
  agency: namedRefWireSchema,
  period: z.object({ start: z.string(), end: z.string() }),
  state: bookingStateSchema,
  pickup: bookingPickupWireSchema,
  pricing: pricingWireSchema,
  timestamps: z.object({
    requestedAt: z.string(),
    acceptedAt: z.string().nullable(),
    pickedUpAt: z.string().nullable(),
    returnedAt: z.string().nullable(),
    settledAt: z.string().nullable(),
    updatedAt: z.string(),
  }),
  rejectionReason: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  /** Renter identity — present ONLY for the agency/admin viewer. */
  customer: bookingCustomerWireSchema.optional(),
  /** Agency/admin viewers only, and only where the route resolved it. */
  renterDocuments: renterDocumentsWireSchema.optional(),
  /** Frozen booking deposit from the backend, cents. */
  depositCents: z.number(),
  /** `depositCents > 0`; the hold is returned and is not part of the total. */
  depositRequired: z.boolean(),
  /** Check-in / check-out inspections (ADR-0011), lightweight refs. */
  inspections: z.array(
    z.object({
      type: inspectionTypeSchema,
      status: inspectionStatusSchema,
      id: z.string(),
    }),
  ),
  /** The hand-over code step. Always present. */
  handover: bookingHandoverWireSchema,
});

export const cancellationQuoteWireSchema = z.object({
  refundCents: z.number(),
  retainedCents: z.number(),
  currency: z.string(),
  /** True when the free-cancellation window has already closed. */
  isLate: z.boolean(),
  tier: z.enum(["free", "late", "closed"]),
  freeUntil: z.string().nullable(),
});

export const bookingDetailWireSchema = bookingWireSchema.extend({
  payment: z
    .object({
      status: paymentLifecycleStatusSchema,
      /** Non-null ONLY while `requires_action` — the resume-3DS credential. */
      clientSecret: z.string().nullable(),
    })
    .optional(),
  agreement: bookingAgreementWireSchema.nullable(),
  deposit: depositWireSchema.nullable(),
  claim: claimWireSchema.nullable(),
  settlement: settlementWireSchema.nullable(),
  /** Refund preview — owning customer only, in `requested | accepted`. */
  cancellationQuote: cancellationQuoteWireSchema.optional(),
});

export const bookingWithPaymentWireSchema = bookingWireSchema.extend({
  payment: z.object({
    status: bookingPaymentStatusSchema,
    clientSecret: z.string().nullable(),
  }),
});

export const quoteWireSchema = z.object({
  pricing: pricingWireSchema,
  /** The deposit this booking would hold, resolved car -> agency -> platform. */
  depositCents: z.number(),
  /** `depositCents > 0`. A hold that is returned — never part of the total. */
  depositRequired: z.boolean(),
  expiresAt: z.string(),
  token: z.string(),
});

export const signedUrlWireSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
});

// --------------------------------------------------------------- messaging

export const messageWireSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  /** The raw sender user id is NOT exposed by the API. */
  senderRole: z.enum(["customer", "agency"]),
  body: z.string(),
  createdAt: z.string(),
});

export const messageThreadWithMessagesWireSchema = z.object({
  thread: z.object({ id: z.string(), bookingId: z.string() }),
  messages: z.array(messageWireSchema),
});

// ------------------------------------------------------------ list wrappers

export const bookingListWireSchema = z.array(bookingWireSchema);
export const inspectionListWireSchema = z.array(inspectionWireSchema);

// ------------------------------------------------------------ input schemas

/**
 * The backend request body for both the quote preview and the
 * request-to-book (flat, half-open `[start, end)`).
 */
export const quoteInputSchema = z.object({
  carId: z.string(),
  start: z.string(),
  end: z.string(),
  pickupType: pickupTypeSchema.optional(),
  /** Delivery: EITHER a predefined zone… */
  deliveryZoneId: z.string().optional(),
  /** …OR a geocoded address (Google Places) — the server computes the fee. */
  deliveryAddress: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  /** The chosen place's city; the server decides coverage with it. */
  deliveryCityName: z.string().optional(),
  deliveryReference: z.string().optional(),
});

/** Backend `SignatureDto`: the typed full name of the click-to-sign. */
export const signatureInputSchema = z.object({
  typedName: z.string(),
});

export const requestBookingInputSchema = quoteInputSchema.extend({
  /** The saved card the hold goes on; absent → the backend's default. */
  paymentMethodId: z.string().optional(),
  /** The version from `GET /legal/current` the customer just accepted. */
  termsVersion: z.string(),
  signature: signatureInputSchema,
});

export const respondClaimInputSchema = z.object({
  accept: z.boolean(),
  /** Optional explanation, ≤1000 characters (shown to host and admins). */
  note: z.string().optional(),
});

// --------------------------------------------------------------- form schemas

/** Backend `CancelBookingDto` / `RejectBookingDto`: reason 2..160 characters. */
export const BOOKING_REASON_MIN = 2;
export const BOOKING_REASON_MAX = 160;

/** `POST /bookings/:id/cancel { reason }` — the reason is shown to the agency. */
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Tell the agency why you are cancelling (at least 3 characters)")
    .max(
      BOOKING_REASON_MAX,
      `Keep the reason to ${BOOKING_REASON_MAX} characters or fewer`,
    ),
});

/** Backend `SignatureDto`: typedName 2..160 (spec §4.B7). */
export const TYPED_NAME_MIN = 2;
export const TYPED_NAME_MAX = 160;

/**
 * "Review and sign the rental agreement" step of the request flow: the
 * typed full name IS the electronic signature; the checkbox is the explicit
 * consent (the server answers 400 SIGNATURE_REQUIRED without either).
 */
export const signRentalAgreementSchema = z.object({
  typedName: z
    .string()
    .trim()
    .min(TYPED_NAME_MIN, "Type your full legal name to sign")
    .max(TYPED_NAME_MAX, `At most ${TYPED_NAME_MAX} characters`),
  acceptAgreement: z.boolean().refine((v) => v === true, {
    message: "Tick the box to confirm you have read and agree to the agreement",
  }),
});

/** `POST /bookings/:id/inspections/:inspectionId/dispute { note }`: 2..1000. */
export const INSPECTION_DISPUTE_NOTE_MIN = 2;
export const INSPECTION_DISPUTE_NOTE_MAX = 1000;

export const disputeInspectionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(
      INSPECTION_DISPUTE_NOTE_MIN,
      "Describe what you disagree with (at least 2 characters)",
    )
    .max(
      INSPECTION_DISPUTE_NOTE_MAX,
      `Keep the note to ${INSPECTION_DISPUTE_NOTE_MAX} characters or fewer`,
    ),
});

/** `POST /bookings/:id/claims/:claimId/respond { accept, note? }`: note ≤1000. */
export const CLAIM_NOTE_MAX = 1000;

export const respondClaimSchema = z.object({
  response: z.enum(["accept", "reject"], {
    error: "Choose whether you accept or reject the claim",
  }),
  note: z
    .string()
    .trim()
    .max(
      CLAIM_NOTE_MAX,
      `Keep the note to ${CLAIM_NOTE_MAX} characters or fewer`,
    ),
});

/** `POST /bookings/:id/deposit/retry { paymentMethodId }` — a saved card id. */
export const retryDepositSchema = z.object({
  paymentMethodId: z.string().min(1, "Choose the card for the deposit hold"),
});
