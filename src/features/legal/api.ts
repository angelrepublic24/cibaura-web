import { Api } from "@/shared/api/client";
import type { LegalCurrentDto } from "@/shared/types/domain";

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
 */

export const legalKeys = {
  all: ["legal"] as const,
  current: () => ["legal", "current"] as const,
};

export const LegalApi = {
  async current(): Promise<LegalCurrentDto> {
    const res = await Api.get<LegalCurrentDto>("/legal/current");
    return res.data;
  },
};
