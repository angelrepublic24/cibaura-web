import { getDomain } from "tldts";

/** ADR-0006: use the Public Suffix List, including private hosting suffixes. */
export function assertSameSite(site: URL, api: URL): void {
  const siteDomain = getDomain(site.hostname, { allowPrivateDomains: true });
  const apiDomain = getDomain(api.hostname, { allowPrivateDomains: true });
  if (!siteDomain || !apiDomain || siteDomain !== apiDomain) {
    throw new Error(
      "[config] NEXT_PUBLIC_SITE_URL and NEXT_PUBLIC_API_URL must share the same registrable domain (ADR-0006, SameSite=Lax cookies).",
    );
  }
}
