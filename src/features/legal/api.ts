import { Api } from "@/shared/api/client";
import type {
  ContractTemplatePublicDto,
  LegalCurrentDto,
} from "@/shared/types/domain";

/**
 * Legal API module.
 *
 * Backend route (public, no auth):
 *  - GET /legal/current -> { termsVersion, termsUrl, privacyUrl,
 *        cancellationPolicy: { freeCancellationHours,
 *                              lateCancellationRetentionPct,
 *                              earlyReturnPenaltyDays } }
 *
 * The backend owns the current terms version (`CURRENT_TERMS_VERSION`) AND
 * the cancellation-policy figures. Register, password reset and
 * request-to-book send that exact version back as `termsVersion` +
 * `acceptTerms: true`; the server answers 409 `TERMS_OUTDATED` when a client
 * holds a stale one. Policy numbers are rendered from this payload — never
 * hardcoded in copy.
 *
 * Contracts (ADR-0010, spec §4.B7):
 *  - GET /legal/contracts/:kind -> ContractTemplatePublicDto
 *        { kind, version, title, html }  (public; the PUBLISHED template
 *        with placeholders rendered as `[host legal name]` etc. — shown
 *        before any booking variables exist). `kind` is
 *        `rental_agreement | host_agreement`. 409 TEMPLATE_NOT_PUBLISHED
 *        when no version is published for the kind.
 */

export const CONTRACT_KIND_RENTAL_AGREEMENT = "rental_agreement";
export const CONTRACT_KIND_HOST_AGREEMENT = "host_agreement";

export const legalKeys = {
  all: ["legal"] as const,
  current: () => ["legal", "current"] as const,
  contract: (kind: string) => ["legal", "contract", kind] as const,
};

export const LegalApi = {
  async current(): Promise<LegalCurrentDto> {
    const res = await Api.get<LegalCurrentDto>("/legal/current");
    return res.data;
  },

  /** The published template of `kind`, with generic placeholders. */
  async contract(kind: string): Promise<ContractTemplatePublicDto> {
    const res = await Api.get<ContractTemplatePublicDto>(
      `/legal/contracts/${kind}`,
    );
    return res.data;
  },
};
