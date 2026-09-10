"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { BookingsApi, bookingKeys, type QuoteInput } from "./api";

/**
 * Query hooks for the customer booking surfaces. Mutations stay next to
 * the forms that own them (they need form state for error handling); the
 * queries live here so every card on the booking page shares ONE request
 * per key.
 */

export function useBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => BookingsApi.findById(bookingId),
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
    queryFn: () => BookingsApi.listInspections(bookingId),
    staleTime: 60_000,
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
    queryFn: () => BookingsApi.agreementPreview(input),
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
}

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
