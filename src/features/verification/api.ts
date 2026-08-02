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
 * Customer identity/licence verification API (ADR-0004).
 *
 * Backend contract (verified against verification.controller.ts, all under /api):
 *  Customer (any authenticated user):
 *   - GET  /verification/me            -> { verification, documents }
 *   - POST /verification { licenseNumber, licenseExpiry } -> CustomerVerification
 *       (an already-expired licence auto-REJECTS server-side)
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
}

export const VerificationApi = {
  // ── Customer ──
  async me(): Promise<CustomerVerificationWithDocuments> {
    const res = await Api.get("/verification/me");
    return res.data;
  },

  async submit(input: SubmitVerificationInput): Promise<CustomerVerification> {
    const res = await Api.post("/verification", input);
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
