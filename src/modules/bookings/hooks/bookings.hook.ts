import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { bookingsService } from "@/modules/bookings/services/bookings.service";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  isApiErrorCode,
} from "@/shared/api/errors";
import type {
  QuoteInput,
  RequestBookingInput,
  RespondClaimInput,
} from "@/modules/bookings/types/bookings.types";
import type { BookingState } from "@/shared/types/domain";

/** Query keys for the bookings module (the only cache it owns). */
export const bookingKeys = {
  all: ["bookings"] as const,
  mine: (filters: { state?: BookingState } = {}) =>
    ["bookings", "me", filters] as const,
  detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
  cancellationQuote: (bookingId: string) =>
    ["bookings", "cancellation-quote", bookingId] as const,
  quote: (input: QuoteInput) => ["bookings", "quote", input] as const,
  agreementPreview: (input: QuoteInput) =>
    ["bookings", "agreement-preview", input] as const,
  inspections: (bookingId: string) =>
    ["bookings", "inspections", bookingId] as const,
  messages: (bookingId: string) => ["bookings", "messages", bookingId] as const,
};

/**
 * After anything that moves a booking (confirm/dispute an inspection,
 * answer a claim, retry the deposit): the detail, its inspections and the
 * customer's lists are all stale at once.
 */
export function invalidateBooking(qc: QueryClient, bookingId: string): void {
  void qc.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
  void qc.invalidateQueries({ queryKey: bookingKeys.inspections(bookingId) });
  void qc.invalidateQueries({ queryKey: bookingKeys.mine() });
}

/**
 * The same refresh as a callback, for the places that have to hand one to
 * something else (the 3DS state machine's `onAuthorized`) instead of
 * chaining it off a mutation.
 */
export function useInvalidateBooking(bookingId: string): () => void {
  const qc = useQueryClient();
  return useCallback(
    () => invalidateBooking(qc, bookingId),
    [qc, bookingId],
  );
}

// ── Queries ─────────────────────────────────────────────────────────────────

export function useMyBookings() {
  return useQuery({
    queryKey: bookingKeys.mine(),
    queryFn: () => bookingsService.findMine(),
  });
}

export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => bookingsService.findById(bookingId),
    // Surface deposits, inspections and newly filed claims while the customer
    // leaves this page open. Pause polling in background tabs.
    refetchInterval: (query) => {
      const booking = query.state.data;
      return booking &&
        (["accepted", "active", "returned"].includes(booking.state) ||
          booking.claim?.status === "open")
        ? 30_000
        : false;
    },
    refetchIntervalInBackground: false,
  });
}

/**
 * The booking's inspections with SIGNED media URLs (short TTL). Refetched
 * on focus/mount after a minute so expired links are replaced before the
 * viewer needs them; `enabled` lets callers skip the request until the
 * booking says an inspection exists (`booking.inspections`).
 */
export function useBookingInspections(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.inspections(bookingId),
    queryFn: () => bookingsService.listInspections(bookingId),
    staleTime: 60_000,
    enabled,
  });
}

/**
 * The server's price preview for a candidate rental. Keyed by the WHOLE
 * input, so changing a date, the pickup type or the delivery point asks for
 * a new quote instead of showing the previous one.
 */
export function useBookingQuote(input: QuoteInput, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.quote(input),
    queryFn: () => bookingsService.quote(input),
    enabled,
  });
}

/**
 * The rental agreement rendered with the real quote — fetched fresh every
 * time the sign step opens (the published template or the customer's own
 * data may have changed since the last preview).
 */
export function useAgreementPreview(input: QuoteInput, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.agreementPreview(input),
    queryFn: () => bookingsService.agreementPreview(input),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * What cancelling NOW would refund and retain. Never cached: the answer
 * depends on the clock (the free window closes on one), so a stale quote
 * would show a refund the server will not honour.
 */
export function useCancellationQuote(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: bookingKeys.cancellationQuote(bookingId),
    queryFn: () => bookingsService.cancellationQuote(bookingId),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

/**
 * The same booking detail, polled HARD while a card authorization is being
 * verified after a 3DS redirect (see `useRequestPayment`): every tick hits
 * the server, background tabs included, because the whole point is to catch
 * the webhook landing. The result stays under the canonical detail key, so
 * the booking page paints instantly right after the redirect.
 */
export function useBookingVerificationPoll(
  bookingId: string,
  options: { enabled: boolean; refetchInterval: number },
) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => bookingsService.findById(bookingId),
    enabled: options.enabled,
    refetchInterval: options.refetchInterval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false, // refetchInterval already retries every tick
  });
}

export function useBookingMessages(
  bookingId: string,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: bookingKeys.messages(bookingId),
    queryFn: () => bookingsService.listMessages(bookingId),
    enabled: options.enabled,
    refetchInterval: options.refetchInterval,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Request-to-book. Deliberately does NOT invalidate anything: the caller
 * must first branch on `payment.status` (a `requires_action` result still
 * needs the 3DS challenge) before deciding what to refresh.
 */
export function useRequestBooking() {
  return useMutation({
    mutationFn: (input: RequestBookingInput) => bookingsService.request(input),
  });
}

export function useCancelBooking(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => bookingsService.cancel(bookingId, reason),
    onSuccess: () => invalidateBooking(qc, bookingId),
  });
}

/**
 * Place the deposit hold again. Callers MUST branch on the returned
 * `status`: `requires_action` carries the client secret for the 3DS
 * challenge, which only the caller can run.
 */
export function useRetryDeposit(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentMethodId?: string) =>
      bookingsService.retryDeposit(bookingId, paymentMethodId),
    onSuccess: () => invalidateBooking(qc, bookingId),
    onError: (error) => {
      // A challenge is already pending — and its secret lives on the detail.
      if (isApiErrorCode(error, API_ERROR_CODES.DEPOSIT_REQUIRES_ACTION)) {
        invalidateBooking(qc, bookingId);
      }
    },
  });
}

/**
 * A WRONG_STATE answer to either inspection action means someone already
 * finalized it; our copy is the stale one, so refresh on that error too.
 */
function inspectionActionError(qc: QueryClient, bookingId: string) {
  return (error: unknown) => {
    if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) {
      invalidateBooking(qc, bookingId);
    }
  };
}

export function useConfirmInspection(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inspectionId: string) =>
      bookingsService.confirmInspection(bookingId, inspectionId),
    onSuccess: () => invalidateBooking(qc, bookingId),
    onError: inspectionActionError(qc, bookingId),
  });
}

export function useDisputeInspection(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { inspectionId: string; note: string }) =>
      bookingsService.disputeInspection(
        bookingId,
        input.inspectionId,
        input.note,
      ),
    onSuccess: () => invalidateBooking(qc, bookingId),
    onError: inspectionActionError(qc, bookingId),
  });
}

export function useRespondClaim(bookingId: string, claimId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RespondClaimInput) =>
      bookingsService.respondClaim(bookingId, claimId, input),
    onSuccess: () => invalidateBooking(qc, bookingId),
    onError: (error) => {
      // "Already closed" / "window closed" means our copy of the claim is
      // the stale one — refresh so the form stops asking for an answer.
      const code = getApiErrorCode(error);
      if (
        code === API_ERROR_CODES.CLAIM_NOT_OPEN ||
        code === API_ERROR_CODES.CLAIM_RESPONSE_WINDOW_CLOSED
      ) {
        invalidateBooking(qc, bookingId);
      }
    },
  });
}

export function useSendBookingMessage(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      bookingsService.sendMessage(bookingId, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: bookingKeys.messages(bookingId) }),
  });
}

/**
 * Open the signed (or countersigned) agreement PDF. The link is short-lived
 * and minted on click — never cached, or the next click gets a dead URL.
 * The shared opener handles the popup-blocker dance; this hook is only what
 * keeps the component from reaching for the service itself.
 */
export function useOpenAgreementPdf(bookingId: string) {
  return useOpenSignedUrl(() => bookingsService.agreementPdf(bookingId));
}
