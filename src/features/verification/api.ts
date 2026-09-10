import { Api } from "@/shared/api/client";
import type {
  CustomerDocument,
  CustomerDocumentType,
  CustomerVerification,
  CustomerVerificationAdmin,
  CustomerVerificationStatus,
  CustomerVerificationWithDocuments,
} from "@/shared/types/domain";

/**
 * Customer identity/license verification API (DOMAIN.md "Identity & KYC
 * gates" / ADR-0007).
 *
 * Backend contract (all under /api):
 *  Customer (any authenticated user):
 *   - GET  /verification/me            -> { verification, documents }
 *   - POST /verification { licenseNumber, licenseExpiry, dateOfBirth }
 *       -> CustomerVerification (an already-expired license auto-REJECTS
 *          server-side; `dateOfBirth` is required and must be at least 16
 *          years ago — agencies enforce their own minimum driver age at
 *          request time via DRIVER_TOO_YOUNG)
 *   - PATCH /verification/me { dateOfBirth } -> CustomerVerification
 *       (ONLY while the stored date of birth is null; 409 otherwise. Does not
 *        change the verification status — lets already-verified customers
 *        add the field the age gate needs without re-submitting.)
 *   - POST /verification/documents  (multipart: file + type) -> CustomerDocument
 *  Admin (platform_admin):
 *   - GET   /verification/customers?status=              -> CustomerVerificationAdmin[]
 *   - GET   /verification/customers/:userId              -> CustomerVerificationAdmin
 *   - GET   /verification/customers/:userId/documents/:docId -> file bytes (blob)
 *   - PATCH /verification/customers/:userId/verify       -> CustomerVerificationAdmin
 *   - PATCH /verification/customers/:userId/reject { reason } -> CustomerVerificationAdmin
 *
 * The booking gate itself lives on the server (assertCanRent in requestBooking);
 * the client reads `/verification/me` only to surface the right CTA up front.
 */

export const verificationKeys = {
  all: ["verification"] as const,
  me: () => ["verification", "me"] as const,
  customers: (status?: string) =>
    ["verification", "customers", status ?? "pending"] as const,
  customer: (userId: string) => ["verification", "customer", userId] as const,
};

export interface SubmitVerificationInput {
  licenseNumber: string;
  licenseExpiry: string; // YYYY-MM-DD
  dateOfBirth: string; // YYYY-MM-DD
}

export const VerificationApi = {
  // ── Customer ──
  async me(): Promise<CustomerVerificationWithDocuments> {
    const res = await Api.get("/verification/me");
    return res.data;
  },

  async submit(input: SubmitVerificationInput): Promise<CustomerVerification> {
    const res = await Api.post<CustomerVerification>("/verification", input);
    return res.data;
  },

  /** Add the date of birth to an existing record (allowed only while null). */
  async setDateOfBirth(dateOfBirth: string): Promise<CustomerVerification> {
    const res = await Api.patch<CustomerVerification>("/verification/me", {
      dateOfBirth,
    });
    return res.data;
  },

  async uploadDocument(
    file: File,
    type: CustomerDocumentType,
  ): Promise<CustomerDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post("/verification/documents", form);
    return res.data;
  },

  // ── Admin ──
  async listCustomers(
    status?: CustomerVerificationStatus,
  ): Promise<CustomerVerificationAdmin[]> {
    const res = await Api.get("/verification/customers", {
      params: { status },
    });
    return res.data;
  },

  async getCustomer(userId: string): Promise<CustomerVerificationAdmin> {
    const res = await Api.get(`/verification/customers/${userId}`);
    return res.data;
  },

  async verifyCustomer(userId: string): Promise<CustomerVerificationAdmin> {
    const res = await Api.patch(`/verification/customers/${userId}/verify`, {});
    return res.data;
  },

  async rejectCustomer(
    userId: string,
    reason: string,
  ): Promise<CustomerVerificationAdmin> {
    const res = await Api.patch(`/verification/customers/${userId}/reject`, {
      reason,
    });
    return res.data;
  },

  /** Fetch a document's bytes (with auth) as a Blob to view in a new tab. */
  async downloadDocument(userId: string, docId: string): Promise<Blob> {
    const res = await Api.get(
      `/verification/customers/${userId}/documents/${docId}`,
      { responseType: "blob" },
    );
    return res.data;
  },
};
