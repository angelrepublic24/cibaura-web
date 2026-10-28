import { Api } from "@/shared/api/client";
import type {
  ContractKind,
  ContractTemplatePublicDto,
  LegalCurrentDto,
} from "@/shared/types/domain";
import {
  contractTemplatePublicWireSchema,
  legalCurrentWireSchema,
} from "@/modules/legal/schema/legal.schema";

/**
 * Legal API client — the ONLY thing in the module that talks to the backend.
 * Hooks call these, components call hooks.
 *
 * Backend routes (public, no auth):
 *  - GET /legal/current         -> { termsVersion, termsUrl, privacyUrl,
 *                                    cancellationPolicy }
 *  - GET /legal/contracts/:kind -> ContractTemplatePublicDto
 *      409 TEMPLATE_NOT_PUBLISHED when no version is published for the kind
 *
 * The backend owns `CURRENT_TERMS_VERSION` and the cancellation figures.
 * Register, password reset and request-to-book send that exact version back
 * as `termsVersion` + `acceptTerms: true`; the server answers 409
 * `TERMS_OUTDATED` when a client holds a stale one. Policy numbers are
 * rendered from this payload — never hardcoded in copy.
 */
class LegalService {
  async current(): Promise<LegalCurrentDto> {
    const res = await Api.get<unknown>("/legal/current");
    return legalCurrentWireSchema.parse(res.data);
  }

  /** The published template of `kind`, with generic placeholders. */
  async contract(kind: ContractKind): Promise<ContractTemplatePublicDto> {
    const res = await Api.get<unknown>(
      `/legal/contracts/${encodeURIComponent(kind)}`,
    );
    return contractTemplatePublicWireSchema.parse(res.data);
  }
}

export const legalService = new LegalService();
