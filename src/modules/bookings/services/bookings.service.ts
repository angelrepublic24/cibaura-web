import { Api } from "@/shared/api/client";
import type {
  Booking,
  BookingDetail,
  BookingWithPayment,
  CancellationQuoteDto,
  ClaimDto,
  ContractTemplatePublicDto,
  DepositDto,
  InspectionDto,
  Message,
  Quote,
  SignedUrlDto,
} from "@/shared/types/domain";
import { contractTemplatePublicWireSchema } from "@/modules/legal/schema/legal.schema";
import { bookingDetailWireSchema, bookingListWireSchema, bookingWireSchema, bookingWithPaymentWireSchema, cancellationQuoteWireSchema, claimWireSchema, depositWireSchema, inspectionListWireSchema, inspectionWireSchema, messageThreadWithMessagesWireSchema, messageWireSchema, quoteInputSchema, quoteWireSchema, requestBookingInputSchema, respondClaimInputSchema, signedUrlWireSchema } from "@/modules/bookings/schema/bookings.schema";
import type {
  QuoteInput,
  RequestBookingInput,
  RespondClaimInput,
} from "@/modules/bookings/types/bookings.types";

/**
 * Bookings API client — the ONLY thing in the module that talks to the
 * backend. Hooks call these, components call hooks.
 *
 * The customer side of a booking's whole life: the server quote,
 * request-to-book, detail, cancel, chat, plus the rental agreement, the
 * deposit, inspections and claims.
 *
 *  - POST /bookings/quote               -> Quote (NO booking created)
 *      400 RENTAL_TOO_LONG when `days > MAX_RENTAL_DAYS`
 *  - POST /bookings/agreement-preview   -> ContractTemplatePublicDto
 *      409 TEMPLATE_NOT_PUBLISHED when no version is published
 *  - POST /bookings                     -> Booking + payment
 *      Gate errors (stable `code`): 403 CUSTOMER_NOT_VERIFIED /
 *      VERIFICATION_INCOMPLETE / DRIVER_TOO_YOUNG /
 *      LICENSE_EXPIRES_BEFORE_END, 409 TERMS_OUTDATED /
 *      TEMPLATE_NOT_PUBLISHED, 400 TERMS_ACCEPTANCE_REQUIRED /
 *      SIGNATURE_REQUIRED / RENTAL_TOO_LONG
 *  - GET  /bookings/mine                -> Booking[]
 *  - GET  /bookings/:id                 -> BookingDetail
 *  - GET  /bookings/:id/agreement/pdf   -> SignedUrlDto
 *  - GET  /bookings/:id/cancellation-quote -> CancellationQuoteDto
 *  - POST /bookings/:id/cancel          -> Booking
 *  - POST /bookings/:id/deposit/retry   -> DepositDto
 *  - GET  /bookings/:id/inspections     -> InspectionDto[]
 *  - POST /bookings/:id/inspections/:inspectionId/confirm|dispute -> InspectionDto
 *  - POST /bookings/:id/claims/:claimId/respond -> ClaimDto
 *  - GET/POST /messages/bookings/:id    -> the per-booking chat
 *
 * Agency-side transitions live under `/agency/requests/*`
 * (`modules/agency`) — never here.
 */
class BookingsService {
  /**
   * Server-computed price preview shown BEFORE the booking is created.
   * Clients render the returned cents verbatim — never multiply days×rate.
   *
   * The WHOLE quote is returned, not just `pricing`: the deposit it carries
   * is the one this booking would actually hold (car -> agency -> platform),
   * which the car's own resolved figure cannot answer once a host sets an
   * agency default.
   */
  async quote(input: QuoteInput): Promise<Quote> {
    const body = quoteInputSchema.parse(input);
    const res = await Api.post<unknown>("/bookings/quote", body);
    return quoteWireSchema.parse(res.data);
  }

  /**
   * The rental agreement exactly as it will be signed — rendered by the
   * server with the real quote/customer/car/host variables. Shown in the
   * "Review and sign" step before the request is sent.
   */
  async agreementPreview(
    input: QuoteInput,
  ): Promise<ContractTemplatePublicDto> {
    const body = quoteInputSchema.parse(input);
    const res = await Api.post<unknown>("/bookings/agreement-preview", body);
    return contractTemplatePublicWireSchema.parse(res.data);
  }

  /**
   * Request-to-book. The response carries the REAL payment outcome under
   * `payment` — callers must branch on `payment.status` (authorized /
   * requires_action / failed) instead of assuming the hold succeeded.
   */
  async request(input: RequestBookingInput): Promise<BookingWithPayment> {
    const { termsVersion, signature, ...rest } =
      requestBookingInputSchema.parse(input);
    const res = await Api.post<unknown>("/bookings", {
      ...rest,
      acceptTerms: true,
      termsVersion,
      signature,
    });
    return bookingWithPaymentWireSchema.parse(res.data);
  }

  async findMine(): Promise<Booking[]> {
    const res = await Api.get<unknown>("/bookings/mine");
    return bookingListWireSchema.parse(res.data);
  }

  async findById(bookingId: string): Promise<BookingDetail> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}`,
    );
    return bookingDetailWireSchema.parse(res.data);
  }

  /** Short-lived link to the signed (or countersigned) rental agreement PDF. */
  async agreementPdf(bookingId: string): Promise<SignedUrlDto> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/agreement/pdf`,
    );
    return signedUrlWireSchema.parse(res.data);
  }

  /** Refund preview for cancelling now — rendered verbatim, never derived. */
  async cancellationQuote(bookingId: string): Promise<CancellationQuoteDto> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/cancellation-quote`,
    );
    return cancellationQuoteWireSchema.parse(res.data);
  }

  /** Customer cancellation; the reason is required and shown to the agency. */
  async cancel(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/cancel`,
      { reason },
    );
    return bookingWireSchema.parse(res.data);
  }

  /**
   * Place the security-deposit hold again (after `failed` / `lapsed`),
   * optionally on a different saved card. The outcome is the new
   * `DepositDto` — `requires_action` carries the client secret for 3DS.
   */
  async retryDeposit(
    bookingId: string,
    paymentMethodId?: string,
  ): Promise<DepositDto> {
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/deposit/retry`,
      paymentMethodId ? { paymentMethodId } : {},
    );
    return depositWireSchema.parse(res.data);
  }

  /** Check-in / check-out inspections of a booking, with signed media URLs. */
  async listInspections(bookingId: string): Promise<InspectionDto[]> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/inspections`,
    );
    return inspectionListWireSchema.parse(res.data);
  }

  /** The customer agrees with the host's record → finalizes the inspection. */
  async confirmInspection(
    bookingId: string,
    inspectionId: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/inspections/${encodeURIComponent(inspectionId)}/confirm`,
    );
    return inspectionWireSchema.parse(res.data);
  }

  /**
   * The customer disagrees; the note (2..1000) is attached to the record and
   * admins are alerted. The inspection still finalizes (the car has moved).
   */
  async disputeInspection(
    bookingId: string,
    inspectionId: string,
    note: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/inspections/${encodeURIComponent(inspectionId)}/dispute`,
      { note },
    );
    return inspectionWireSchema.parse(res.data);
  }

  /** Accept or reject a damage claim within the response window. */
  async respondClaim(
    bookingId: string,
    claimId: string,
    input: RespondClaimInput,
  ): Promise<ClaimDto> {
    const body = respondClaimInputSchema.parse(input);
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/claims/${encodeURIComponent(claimId)}/respond`,
      body,
    );
    return claimWireSchema.parse(res.data);
  }

  /**
   * The backend returns `{ thread, messages }`; the chat UI only needs the
   * ordered messages, so `.messages` is unwrapped here (the thread ref is
   * derivable from the booking and unused by the panel).
   */
  async listMessages(bookingId: string): Promise<Message[]> {
    const res = await Api.get<unknown>(
      `/messages/bookings/${encodeURIComponent(bookingId)}`,
    );
    return messageThreadWithMessagesWireSchema.parse(res.data).messages;
  }

  async sendMessage(bookingId: string, body: string): Promise<Message> {
    const res = await Api.post<unknown>(
      `/messages/bookings/${encodeURIComponent(bookingId)}`,
      { body },
    );
    return messageWireSchema.parse(res.data);
  }
}

export const bookingsService = new BookingsService();
