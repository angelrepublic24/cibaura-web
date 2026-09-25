import { Api } from "@/shared/api/client";
import type {
  Booking,
  BookingDetail,
  BookingState,
  BookingWithPayment,
  CancellationQuoteDto,
  ClaimDto,
  ContractTemplatePublicDto,
  DepositDto,
  InspectionDto,
  Message,
  MessageThreadWithMessages,
  PickupType,
  Pricing,
  Quote,
  SignedUrlDto,
} from "@/shared/types/domain";

/**
 * Bookings API module (server quote + request-to-book + detail + cancel + chat
 * + the customer side of the v1 expansion: rental agreement, deposit,
 * inspections, claims).
 *
 * Backend contract (docs/DOMAIN.md, all under /api):
 *  - POST /bookings/quote  { carId, start, end, pickupType?, deliveryZoneId? }
 *      -> { pricing: Pricing }   (SERVER-side price preview; NO booking created)
 *      400 RENTAL_TOO_LONG when `days > MAX_RENTAL_DAYS`
 *  - POST /bookings/agreement-preview  (same body as the quote)
 *      -> ContractTemplatePublicDto { kind, version, title, html } — the
 *         published rental agreement rendered with the REAL quote, customer,
 *         car and host variables (`booking.id` reads "[assigned on request]").
 *         409 TEMPLATE_NOT_PUBLISHED when no version is published.
 *  - POST /bookings  { carId, start, end, pickupType?, deliveryZoneId?,
 *         paymentMethodId?, acceptTerms: true, termsVersion,
 *         signature: { typedName } }
 *      -> Booking + payment { status, clientSecret } (state=requested; the
 *         card hold is placed at request, captured at agency accept). When
 *         `payment.status === 'requires_action'` the client must run the
 *         Stripe 3DS next-action with `payment.clientSecret`; on `failed`
 *         no hold exists and the request is auto-rejected server-side.
 *         `paymentMethodId` picks the saved card the hold goes on — validated
 *         server-side (foreign/unknown id -> 404, expired card -> 400); when
 *         absent the backend charges its default card (most recently saved).
 *         `signature.typedName` is the customer's click-to-sign of the rental
 *         agreement (ADR-0010): the signed HTML/PDF snapshot is written in
 *         the SAME transaction as the booking.
 *      Gate errors (stable `code`): 403 CUSTOMER_NOT_VERIFIED /
 *         VERIFICATION_INCOMPLETE (no date of birth) / DRIVER_TOO_YOUNG /
 *         LICENSE_EXPIRES_BEFORE_END, 409 TERMS_OUTDATED /
 *         TEMPLATE_NOT_PUBLISHED, 400 TERMS_ACCEPTANCE_REQUIRED /
 *         SIGNATURE_REQUIRED / RENTAL_TOO_LONG.
 *  - GET  /bookings/mine    -> Booking[]   (bare array — customer's bookings)
 *  - GET  /bookings/:bookingId -> BookingDetail (owner customer OR managing
 *         agency). For the OWNING CUSTOMER it also carries `payment
 *         { status, clientSecret }`, with the secret non-null only while
 *         `requires_action` — the resume-3DS entry point after a reload.
 *         Both parties get `agreement` (null when no snapshot exists),
 *         `deposit`, `claim` and `settlement` (null until they exist);
 *         `deposit.clientSecret` is emitted to the owning customer only
 *         while the deposit is `requires_action`.
 *  - GET  /bookings/:bookingId/agreement/pdf -> SignedUrlDto { url, expiresAt }
 *         (the countersigned PDF when present, else the customer-signed one).
 *  - GET  /bookings/:bookingId/cancellation-quote
 *      -> { refundCents, retainedCents, currency, isLate, tier, freeUntil } — what
 *         cancelling NOW would refund/retain (customer only).
 *  - POST /bookings/:bookingId/cancel { reason } -> Booking
 *         (customer; reason required; 409 CANCELLATION_WINDOW_CLOSED when the
 *          booking can no longer be cancelled online)
 *  - POST /bookings/:bookingId/deposit/retry { paymentMethodId? } -> DepositDto
 *         (place the security-deposit hold again after `failed`/`lapsed`,
 *          optionally on another saved card; 409 DEPOSIT_REQUIRES_ACTION
 *          while a 3DS challenge is still pending)
 *  - GET  /bookings/:bookingId/inspections -> InspectionDto[] (check-in /
 *         check-out records with SIGNED media URLs, parties + admin only)
 *  - POST /bookings/:bookingId/inspections/:inspectionId/confirm -> InspectionDto
 *  - POST /bookings/:bookingId/inspections/:inspectionId/dispute { note }
 *      -> InspectionDto  (both finalize the inspection and move the booking:
 *         checkin -> active, checkout -> returned; 409 INSPECTION_WRONG_STATE
 *         when it is not `submitted`)
 *  - POST /bookings/:bookingId/claims/:claimId/respond { accept, note? }
 *      -> ClaimDto  (accept=true approves at min(requested, deposit) and
 *         captures; accept=false sends it to admin review; 409 CLAIM_NOT_OPEN /
 *         CLAIM_RESPONSE_WINDOW_CLOSED)
 *
 * Agency-side transitions live under `/agency/requests/*`
 * (features/agency/api.ts) — never here.
 *
 * Chat lives on the messaging surface:
 *  - GET  /messages/bookings/:bookingId       -> { thread, messages: Message[] }
 *  - POST /messages/bookings/:bookingId { body } -> Message (the created one)
 */

export const bookingKeys = {
  all: ["bookings"] as const,
  mine: (filters: { state?: BookingState } = {}) =>
    ["bookings", "me", filters] as const,
  detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
  cancellationQuote: (bookingId: string) =>
    ["bookings", "cancellation-quote", bookingId] as const,
  agreementPreview: (input: QuoteInput) =>
    ["bookings", "agreement-preview", input] as const,
  inspections: (bookingId: string) =>
    ["bookings", "inspections", bookingId] as const,
  messages: (bookingId: string) => ["bookings", "messages", bookingId] as const,
};

/**
 * Matches the backend request body for both the quote preview and the
 * request-to-book (flat, half-open `[start, end)`).
 */
export interface QuoteInput {
  carId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, half-open [start, end)
  pickupType?: PickupType;
  /** Delivery: EITHER a predefined zone… */
  deliveryZoneId?: string;
  /** …OR a geocoded address (Google Places) — the server computes the fee. */
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryReference?: string;
}

/** Backend `SignatureDto`: the typed full name of the click-to-sign (2..160). */
export interface SignatureInput {
  typedName: string;
}

/**
 * Request-to-book body: the quote fields plus
 *  - `paymentMethodId?` — the saved card (PaymentMethod.id) the hold is
 *    placed on. Server-validated (404 foreign/unknown, 400 expired); absent
 *    → the backend's default card (the most recently saved one).
 *  - `termsVersion` — the version from `GET /legal/current` the customer
 *    just accepted; sent with `acceptTerms: true` and frozen into the
 *    booking's agreement snapshot.
 *  - `signature` — the click-to-sign of the rental agreement the customer
 *    just read (`POST /bookings/agreement-preview`).
 */
export type RequestBookingInput = QuoteInput & {
  paymentMethodId?: string;
  termsVersion: string;
  signature: SignatureInput;
};

/** `POST /bookings/:id/claims/:claimId/respond` body. */
export interface RespondClaimInput {
  accept: boolean;
  /** Optional explanation, ≤1000 characters (shown to the host and admins). */
  note?: string;
}

export const BookingsApi = {
  /**
   * Server-computed price preview shown BEFORE the booking is created.
   * Clients render the returned cents verbatim — never multiply days×rate.
   */
  async quote(input: QuoteInput): Promise<Pricing> {
    const res = await Api.post<Quote>("/bookings/quote", input);
    return res.data.pricing;
  },

  /**
   * The rental agreement exactly as it will be signed — rendered by the
   * server with the real quote/customer/car/host variables. Shown in the
   * "Review and sign" step before the request is sent.
   */
  async agreementPreview(input: QuoteInput): Promise<ContractTemplatePublicDto> {
    const res = await Api.post<ContractTemplatePublicDto>(
      "/bookings/agreement-preview",
      input,
    );
    return res.data;
  },

  /**
   * Request-to-book. The response carries the REAL payment outcome under
   * `payment` — callers must branch on `payment.status` (authorized /
   * requires_action / failed) instead of assuming the hold succeeded.
   */
  async request(input: RequestBookingInput): Promise<BookingWithPayment> {
    const { termsVersion, signature, ...body } = input;
    const res = await Api.post<BookingWithPayment>("/bookings", {
      ...body,
      acceptTerms: true,
      termsVersion,
      signature,
    });
    return res.data;
  },

  async findMine(): Promise<Booking[]> {
    const res = await Api.get<Booking[]>("/bookings/mine");
    return res.data;
  },

  async findById(bookingId: string): Promise<BookingDetail> {
    const res = await Api.get<BookingDetail>(`/bookings/${bookingId}`);
    return res.data;
  },

  /** Short-lived link to the signed (or countersigned) rental agreement PDF. */
  async agreementPdf(bookingId: string): Promise<SignedUrlDto> {
    const res = await Api.get<SignedUrlDto>(
      `/bookings/${bookingId}/agreement/pdf`,
    );
    return res.data;
  },

  /** Refund preview for cancelling now — rendered verbatim, never derived. */
  async cancellationQuote(bookingId: string): Promise<CancellationQuoteDto> {
    const res = await Api.get<CancellationQuoteDto>(
      `/bookings/${bookingId}/cancellation-quote`,
    );
    return res.data;
  },

  /** Customer cancellation; the reason is required and shown to the agency. */
  async cancel(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.post<Booking>(`/bookings/${bookingId}/cancel`, {
      reason,
    });
    return res.data;
  },

  /**
   * Place the security-deposit hold again (after `failed` / `lapsed`),
   * optionally on a different saved card. The outcome is the new
   * `DepositDto` — `requires_action` carries the client secret for 3DS.
   */
  async retryDeposit(
    bookingId: string,
    paymentMethodId?: string,
  ): Promise<DepositDto> {
    const res = await Api.post<DepositDto>(
      `/bookings/${bookingId}/deposit/retry`,
      paymentMethodId ? { paymentMethodId } : {},
    );
    return res.data;
  },

  /** Check-in / check-out inspections of a booking, with signed media URLs. */
  async listInspections(bookingId: string): Promise<InspectionDto[]> {
    const res = await Api.get<InspectionDto[]>(
      `/bookings/${bookingId}/inspections`,
    );
    return res.data;
  },

  /** The customer agrees with the host's record → finalizes the inspection. */
  async confirmInspection(
    bookingId: string,
    inspectionId: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<InspectionDto>(
      `/bookings/${bookingId}/inspections/${inspectionId}/confirm`,
    );
    return res.data;
  },

  /**
   * The customer disagrees; the note (2..1000) is attached to the record and
   * admins are alerted. The inspection still finalizes (the car has moved).
   */
  async disputeInspection(
    bookingId: string,
    inspectionId: string,
    note: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<InspectionDto>(
      `/bookings/${bookingId}/inspections/${inspectionId}/dispute`,
      { note },
    );
    return res.data;
  },

  /** Accept or reject a damage claim within the response window. */
  async respondClaim(
    bookingId: string,
    claimId: string,
    input: RespondClaimInput,
  ): Promise<ClaimDto> {
    const res = await Api.post<ClaimDto>(
      `/bookings/${bookingId}/claims/${claimId}/respond`,
      input,
    );
    return res.data;
  },

  /**
   * The backend returns `{ thread, messages }`; the chat UI only needs the
   * ordered messages, so we unwrap `.messages` here (the thread ref is
   * derivable from the booking and unused by the panel).
   */
  async listMessages(bookingId: string): Promise<Message[]> {
    const res = await Api.get<MessageThreadWithMessages>(
      `/messages/bookings/${bookingId}`,
    );
    return res.data.messages;
  },

  async sendMessage(bookingId: string, body: string): Promise<Message> {
    const res = await Api.post<Message>(`/messages/bookings/${bookingId}`, {
      body,
    });
    return res.data;
  },
};
