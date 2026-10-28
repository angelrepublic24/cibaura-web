import { z } from "zod";
import { CONTRACT_KINDS } from "@/shared/types/domain";

/**
 * Legal wire schemas (zod v4). The backend owns the current terms version
 * AND the cancellation-policy figures; `LegalService` validates both against
 * these so a renamed field fails at the boundary instead of rendering a
 * policy number as `undefined` in customer-facing copy.
 *
 * The `z.infer` types live in `../types/legal.types`.
 */

/** The policy the backend actually enforces, as published to clients. */
export const cancellationPolicyWireSchema = z.object({
  /** Hours of free cancellation, counted from the agency's acceptance. */
  freeCancellationHours: z.number(),
  /** The window never reaches closer than this to the pick-up. */
  freeCancellationCapHoursBeforePickup: z.number(),
  /** And is never shorter than this, whatever the cap says. */
  freeCancellationMinHours: z.number(),
  /** Retained out of what the renter paid on a late cancellation. */
  lateCancellationRetentionPct: z.number(),
  earlyReturnPenaltyDays: z.number(),
});

/** `GET /legal/current` (public). */
export const legalCurrentWireSchema = z.object({
  termsVersion: z.string(),
  termsUrl: z.string(),
  privacyUrl: z.string(),
  cancellationPolicy: cancellationPolicyWireSchema,
});

/** Backend `ContractKind` (spec §0.1), as the shared domain declares it. */
export const contractKindSchema = z.enum(CONTRACT_KINDS);

/**
 * `GET /legal/contracts/:kind` — the PUBLISHED template with generic
 * placeholders. `html` is server-rendered and already sanitized.
 */
export const contractTemplatePublicWireSchema = z.object({
  kind: contractKindSchema,
  version: z.number(),
  title: z.string(),
  html: z.string(),
});

export const contractSignatureWireSchema = z.object({
  role: z.string(),
  method: z.string(),
  typedName: z.string(),
  signedAt: z.string(),
});

/**
 * An immutable signed snapshot (HTML + PDF) with its signatures. Shared:
 * the host agreement (`modules/agency`) and the rental agreement both read
 * this shape back after signing.
 */
export const contractDocumentWireSchema = z.object({
  id: z.string(),
  kind: contractKindSchema,
  templateVersion: z.number(),
  status: z.string(),
  createdAt: z.string(),
  signatures: z.array(contractSignatureWireSchema),
});
