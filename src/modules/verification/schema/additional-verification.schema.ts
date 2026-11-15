import { z } from "zod";

export const additionalDocumentTypeSchema = z.enum([
  "identity_card",
  "passport",
  "proof_of_residence",
]);
export const additionalSlotSchema = z.enum(["id_front", "id_back", "file"]);
export const additionalFileWireSchema = z.object({
  id: z.string(),
  revision: z.number().int().min(1),
  slot: additionalSlotSchema,
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  uploadedAt: z.string(),
});
export const additionalRequestWireSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  documentType: additionalDocumentTypeSchema,
  reason: z.string(),
  requestedBy: z.string().nullable(),
  status: z.enum([
    "requested",
    "submitted",
    "correction_requested",
    "approved",
    "withdrawn",
  ]),
  revision: z.number().int().min(1),
  submittedRevision: z.number().int().min(1).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  submittedAt: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNote: z.string().nullable(),
  files: z.array(additionalFileWireSchema),
  history: z.array(
    z.object({
      id: z.string(),
      action: z.enum([
        "requested",
        "uploaded",
        "submitted",
        "approved",
        "correction_requested",
        "withdrawn",
      ]),
      revision: z.number().int().min(1),
      actor: z.enum(["customer", "admin"]),
      note: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export const createAdditionalRequestSchema = z.object({
  documentType: additionalDocumentTypeSchema,
  reason: z
    .string()
    .trim()
    .min(1, "Explain why this document is needed")
    .max(2000),
  requestedBy: z.iso.date().nullable().optional(),
});
export const reviewAdditionalRequestSchema = z
  .object({
    revision: z.number().int().min(1),
    decision: z.enum(["approve", "correction"]),
    note: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.decision !== "correction" || Boolean(value.note), {
    path: ["note"],
    message: "Explain what needs correcting",
  });
export type AdditionalRequest = z.infer<typeof additionalRequestWireSchema>;
export type AdditionalFile = z.infer<typeof additionalFileWireSchema>;
export type AdditionalSlot = z.infer<typeof additionalSlotSchema>;
export type CreateAdditionalRequest = z.infer<
  typeof createAdditionalRequestSchema
>;
export type ReviewAdditionalRequest = z.infer<
  typeof reviewAdditionalRequestSchema
>;
