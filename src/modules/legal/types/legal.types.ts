import type { z } from "zod";
import type {
  cancellationPolicyWireSchema,
  contractTemplatePublicWireSchema,
  legalCurrentWireSchema,
} from "@/modules/legal/schema/legal.schema";

/**
 * Legal types — every one is the `z.infer` of a schema in `../schema`.
 * They are structurally the shared `LegalCurrentDto` /
 * `CancellationPolicyDto` / `ContractTemplatePublicDto`, which is what the
 * service returns; the service's return annotations enforce that.
 */
export type CancellationPolicyWire = z.infer<
  typeof cancellationPolicyWireSchema
>;
export type LegalCurrentWire = z.infer<typeof legalCurrentWireSchema>;
export type ContractTemplatePublicWire = z.infer<
  typeof contractTemplatePublicWireSchema
>;
