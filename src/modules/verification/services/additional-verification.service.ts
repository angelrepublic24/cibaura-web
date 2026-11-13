import { Api } from "@/shared/api/client";
import { z } from "zod";
import {
  additionalRequestWireSchema,
  createAdditionalRequestSchema,
  reviewAdditionalRequestSchema,
  type AdditionalRequest,
  type AdditionalSlot,
  type CreateAdditionalRequest,
  type ReviewAdditionalRequest,
} from "../schema/additional-verification.schema";

const base = (id: string) =>
  `/verification/additional-requests/${encodeURIComponent(id)}`;
class AdditionalVerificationService {
  async list(customerId?: string): Promise<AdditionalRequest[]> {
    const url = customerId
      ? `/verification/customers/${encodeURIComponent(customerId)}/additional-requests`
      : "/verification/additional-requests";
    return z
      .array(additionalRequestWireSchema)
      .parse((await Api.get<unknown>(url)).data);
  }
  async create(
    customerId: string,
    input: CreateAdditionalRequest,
  ): Promise<AdditionalRequest> {
    return additionalRequestWireSchema.parse(
      (
        await Api.post<unknown>(
          `/verification/customers/${encodeURIComponent(customerId)}/additional-requests`,
          createAdditionalRequestSchema.parse(input),
        )
      ).data,
    );
  }
  async upload(
    requestId: string,
    revision: number,
    slot: AdditionalSlot,
    file: File,
  ): Promise<AdditionalRequest> {
    const body = new FormData();
    body.append("file", file);
    body.append("slot", slot);
    body.append("revision", String(revision));
    return additionalRequestWireSchema.parse(
      (await Api.post<unknown>(`${base(requestId)}/files`, body)).data,
    );
  }
  async submit(
    requestId: string,
    revision: number,
  ): Promise<AdditionalRequest> {
    return additionalRequestWireSchema.parse(
      (await Api.post<unknown>(`${base(requestId)}/submit`, { revision })).data,
    );
  }
  async review(
    requestId: string,
    input: ReviewAdditionalRequest,
  ): Promise<AdditionalRequest> {
    return additionalRequestWireSchema.parse(
      (
        await Api.post<unknown>(
          `${base(requestId)}/review`,
          reviewAdditionalRequestSchema.parse(input),
        )
      ).data,
    );
  }
  async withdraw(
    requestId: string,
    revision: number,
    reason: string,
  ): Promise<AdditionalRequest> {
    return additionalRequestWireSchema.parse(
      (
        await Api.post<unknown>(`${base(requestId)}/withdraw`, {
          revision,
          reason,
        })
      ).data,
    );
  }
  async download(requestId: string, fileId: string) {
    return z
      .object({ url: z.string(), expiresAt: z.string() })
      .parse(
        (
          await Api.get<unknown>(
            `${base(requestId)}/files/${encodeURIComponent(fileId)}/download`,
          )
        ).data,
      );
  }
}
export const additionalVerificationService =
  new AdditionalVerificationService();
