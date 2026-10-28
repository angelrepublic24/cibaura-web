import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { verificationService } from "@/modules/verification/services/verification.service";
import type {
  CustomerDocumentType,
  CustomerVerificationStatus,
} from "@/shared/types/domain";
import type { SubmitVerificationInput } from "@/modules/verification/types/verification.types";

/** Query keys for the verification module (the only cache it owns). */
export const verificationKeys = {
  all: ["verification"] as const,
  me: () => ["verification", "me"] as const,
  customers: (status?: string) =>
    ["verification", "customers", status ?? "pending"] as const,
  customer: (userId: string) => ["verification", "customer", userId] as const,
};

// ── Customer ────────────────────────────────────────────────────────────────

/**
 * The caller's own verification record + documents. `enabled` because the
 * car page reads it for a visitor who may still be a guest.
 */
export function useMyVerification(enabled = true) {
  return useQuery({
    queryKey: verificationKeys.me(),
    queryFn: () => verificationService.me(),
    enabled,
  });
}

/**
 * Every customer-side write refreshes the module subtree: a submission, a
 * date of birth and a document upload all change what `/verification/me`
 * answers, and the admin queue is derived from the same records.
 */
export function useSubmitVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitVerificationInput) =>
      verificationService.submit(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: verificationKeys.all }),
  });
}

export function useSetDateOfBirth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dateOfBirth: string) =>
      verificationService.setDateOfBirth(dateOfBirth),
    onSuccess: () => qc.invalidateQueries({ queryKey: verificationKeys.all }),
  });
}

export function useUploadVerificationDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; type: CustomerDocumentType }) =>
      verificationService.uploadDocument(input.file, input.type),
    onSuccess: () => qc.invalidateQueries({ queryKey: verificationKeys.me() }),
  });
}

// ── Admin ───────────────────────────────────────────────────────────────────

export function useVerificationQueue(status?: CustomerVerificationStatus) {
  return useQuery({
    queryKey: verificationKeys.customers(status),
    queryFn: () => verificationService.listCustomers(status),
  });
}

export function useVerificationCustomer(userId: string) {
  return useQuery({
    queryKey: verificationKeys.customer(userId),
    queryFn: () => verificationService.getCustomer(userId),
  });
}

/**
 * A decision changes the row in EVERY status filter, not just the one on
 * screen, so both invalidate the whole subtree rather than a single list.
 */
export function useVerifyCustomer(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => verificationService.verifyCustomer(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: verificationKeys.all }),
  });
}

export function useRejectCustomer(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      verificationService.rejectCustomer(userId, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: verificationKeys.all }),
  });
}

/**
 * Fetching a document's bytes is a mutation, not a query: it is triggered by
 * a click and its result is consumed once (an object URL opened in a new
 * tab), never cached.
 */
export function useDownloadVerificationDocument(userId: string) {
  return useMutation({
    mutationFn: (docId: string) =>
      verificationService.downloadDocument(userId, docId),
  });
}
