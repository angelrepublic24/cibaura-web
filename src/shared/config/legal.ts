/**
 * Legal identity of the platform operator, rendered on /legal/terms and
 * /legal/privacy. Every value is a public build-time constant
 * (`NEXT_PUBLIC_LEGAL_*`); the fallbacks are neutral brand values so a
 * deployment without them never prints a bracketed placeholder.
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
  /** Dominican tax id (RNC). Undefined when not configured → the line is omitted. */
  rnc: readEnv(process.env.NEXT_PUBLIC_LEGAL_RNC),
  address:
    readEnv(process.env.NEXT_PUBLIC_LEGAL_ADDRESS) ??
    "Santo Domingo, Dominican Republic",
  contactEmail:
    readEnv(process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL) ?? "legal@cibaura.com",
  jurisdiction: "Dominican Republic",
  /** Mirrors backend `CURRENT_TERMS_VERSION`; display fallback only. */
  termsVersionFallback: "2026-09-08",
} as const;
