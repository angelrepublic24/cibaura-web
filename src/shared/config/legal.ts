/**
 * Legal identity of the platform operator, rendered on /legal/terms and
 * /legal/privacy. Every value is a public build-time constant
 * (`NEXT_PUBLIC_LEGAL_*`); production builds require the complete identity. These
 * legacy fallbacks apply only to development or an explicit staging exception.
 *
 * The TERMS VERSION is owned by the backend (`GET /legal/current`); the
 * fallback here only covers the legal pages rendering while that request is
 * in flight or failing. Bumping the backend constant is what publishes new
 * terms — never edit this fallback alone.
 */

function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const LEGAL = {
  /** Legal entity operating the platform (data controller + contracting party). */
  companyName: readEnv(process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME) ?? "Cibaura",
  countryCode: readEnv(process.env.NEXT_PUBLIC_LEGAL_COUNTRY_CODE),
  taxIdLabel: readEnv(process.env.NEXT_PUBLIC_LEGAL_TAX_ID_LABEL) ?? "Tax ID",
  taxId: readEnv(process.env.NEXT_PUBLIC_LEGAL_TAX_ID),
  address:
    readEnv(process.env.NEXT_PUBLIC_LEGAL_ADDRESS) ??
    "Registered address not configured",
  contactEmail:
    readEnv(process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL) ?? "legal@cibaura.com",
  jurisdiction: readEnv(process.env.NEXT_PUBLIC_LEGAL_JURISDICTION) ?? "Jurisdiction not configured",
  disputeForum: readEnv(process.env.NEXT_PUBLIC_LEGAL_DISPUTE_FORUM) ?? "Dispute forum not configured",
  /** Mirrors backend `CURRENT_TERMS_VERSION`; display fallback only. */
  termsVersionFallback: "2026-09-08",
} as const;
