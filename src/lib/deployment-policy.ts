/** Port of backend config.ts:261-283; preserve algorithm and generic-label list. */
const GENERIC_SECOND_LEVEL_LABELS = new Set([
  "co",
  "com",
  "net",
  "org",
  "edu",
  "gov",
]);
export function registrableDomain(hostname: string): string {
  const labels = hostname.trim().toLowerCase().replace(/\.$/, "").split(".");
  if (labels.length <= 2) return labels.join(".");
  // Only adaptation: noUncheckedIndexedAccess requires a fallback; length guarantees it.
  const take = GENERIC_SECOND_LEVEL_LABELS.has(labels[labels.length - 2] ?? "")
    ? 3
    : 2;
  return labels.slice(-take).join(".");
}

/** Exact backend error wording (config.ts:451-453). */
export function assertSameSite(site: URL, api: URL): void {
  const apiHost = api.hostname;
  const origin = site.origin;
  const apiDomain = registrableDomain(apiHost);
  const webDomain = registrableDomain(site.hostname);
  if (webDomain !== apiDomain) {
    throw new Error(
      `API_PUBLIC_URL host "${apiHost}" and FRONTEND_URL origin "${origin}" do not share a registrable domain (${apiDomain} vs ${webDomain}). ` +
        "The web session rides in SameSite=Lax cookies, which browsers only send to the same site — serve both under one domain, e.g. https://cibaura.com + https://api.cibaura.com (ADR-0006)",
    );
  }
}
