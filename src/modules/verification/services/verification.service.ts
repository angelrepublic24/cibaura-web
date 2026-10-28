import { Api } from "@/shared/api/client";
import type {
  CustomerDocument,
  CustomerDocumentType,
  CustomerVerification,
  CustomerVerificationAdmin,
  CustomerVerificationQueueRow,
  CustomerVerificationStatus,
  CustomerVerificationWithDocuments,
} from "@/shared/types/domain";
import {
  customerDocumentWireSchema,
  customerVerificationAdminWireSchema,
  customerVerificationQueueWireSchema,
  customerVerificationWireSchema,
  customerVerificationWithDocumentsWireSchema,
  rejectVerificationInputSchema,
  submitVerificationInputSchema,
} from "@/modules/verification/schema/verification.schema";
import type { SubmitVerificationInput } from "@/modules/verification/types/verification.types";

/**
 * Customer identity/licence verification API client — the ONLY thing in the
 * module that talks to the backend. Hooks call these, components call hooks.
 *
 * Customer (any authenticated user):
 *  - GET   /verification/me        -> { verification, documents }
 *  - POST  /verification           -> CustomerVerification
 *      (an already-expired licence auto-REJECTS server-side; `dateOfBirth`
 *       is required and must be at least 16 years ago — agencies enforce
 *       their own minimum driver age at request time via DRIVER_TOO_YOUNG)
 *  - PATCH /verification/me { dateOfBirth } -> CustomerVerification
 *      (ONLY while the stored date of birth is null; 409 otherwise. Does not
 *       change the status — it lets already-verified customers add the field
 *       the age gate needs without re-submitting.)
 *  - POST  /verification/documents (multipart: file + type) -> CustomerDocument
 *
 * Admin (platform_admin):
 *  - GET   /verification/customers?status=                   -> queue rows
 *  - GET   /verification/customers/:userId                   -> full record
 *  - GET   /verification/customers/:userId/documents/:docId  -> file bytes
 *  - PATCH /verification/customers/:userId/verify            -> full record
 *  - PATCH /verification/customers/:userId/reject { reason }  -> full record
 *
 * The booking gate itself lives on the server (`assertCanRent` in
 * `requestBooking`); the client reads `/verification/me` only to surface the
 * right CTA up front.
 */
class VerificationService {
  // ── Customer ──

  async me(): Promise<CustomerVerificationWithDocuments> {
    const res = await Api.get<unknown>("/verification/me");
    return customerVerificationWithDocumentsWireSchema.parse(res.data);
  }

  async submit(input: SubmitVerificationInput): Promise<CustomerVerification> {
    const body = submitVerificationInputSchema.parse(input);
    const res = await Api.post<unknown>("/verification", body);
    return customerVerificationWireSchema.parse(res.data);
  }

  /** Add the date of birth to an existing record (allowed only while null). */
  async setDateOfBirth(dateOfBirth: string): Promise<CustomerVerification> {
    const res = await Api.patch<unknown>("/verification/me", { dateOfBirth });
    return customerVerificationWireSchema.parse(res.data);
  }

  /**
   * Multipart upload. The file itself is never validated by zod — it is a
   * `File`, not JSON; the backend checks type and size and the response is
   * what gets parsed.
   */
  async uploadDocument(
    file: File,
    type: CustomerDocumentType,
  ): Promise<CustomerDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post<unknown>("/verification/documents", form);
    return customerDocumentWireSchema.parse(res.data);
  }

  // ── Admin ──

  async listCustomers(
    status?: CustomerVerificationStatus,
  ): Promise<CustomerVerificationQueueRow[]> {
    const res = await Api.get<unknown>("/verification/customers", {
      params: { status },
    });
    return customerVerificationQueueWireSchema.parse(res.data);
  }

  async getCustomer(userId: string): Promise<CustomerVerificationAdmin> {
    const res = await Api.get<unknown>(
      `/verification/customers/${encodeURIComponent(userId)}`,
    );
    return customerVerificationAdminWireSchema.parse(res.data);
  }

  async verifyCustomer(userId: string): Promise<CustomerVerificationAdmin> {
    const res = await Api.patch<unknown>(
      `/verification/customers/${encodeURIComponent(userId)}/verify`,
      {},
    );
    return customerVerificationAdminWireSchema.parse(res.data);
  }

  async rejectCustomer(
    userId: string,
    reason: string,
  ): Promise<CustomerVerificationAdmin> {
    const body = rejectVerificationInputSchema.parse({ reason });
    const res = await Api.patch<unknown>(
      `/verification/customers/${encodeURIComponent(userId)}/reject`,
      body,
    );
    return customerVerificationAdminWireSchema.parse(res.data);
  }

  /**
   * A document's bytes, with auth, as a Blob to open in a new tab. Binary —
   * there is no JSON to validate.
   */
  async downloadDocument(userId: string, docId: string): Promise<Blob> {
    const res = await Api.get<Blob>(
      `/verification/customers/${encodeURIComponent(userId)}/documents/${encodeURIComponent(docId)}`,
      { responseType: "blob" },
    );
    return res.data;
  }
}

export const verificationService = new VerificationService();
