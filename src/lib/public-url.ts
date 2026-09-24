/** Shared by next.config and browser constants; never relax this for CI. */
export function publicUrl(
  name: string,
  value: string | undefined,
  developmentFallback: string | undefined,
  production: boolean,
): URL | undefined {
  const raw = value?.trim() || (!production ? developmentFallback : undefined);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`[config] ${name} must be an absolute URL.`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    raw.includes("*")
  ) {
    throw new Error(
      `[config] ${name} must be an HTTP(S) URL without credentials, query, fragment or wildcards.`,
    );
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    production &&
    (url.protocol !== "https:" ||
      !host.includes(".") ||
      /^[\d.]+$/.test(host) ||
      host.includes(":") ||
      /(^|\.)(localhost|local|localdomain|lan|internal|invalid|test|example)$/.test(host) ||
      host.endsWith(".home.arpa") ||
      /(^|\.)example\.(com|net|org)$/.test(host) ||
      /(^|[.\-_])(placeholder|replace|replace_me|changeme)([.\-_]|$)/i.test(
        host,
      ))
  )
    throw new Error(
      `[config] ${name} must use a real public HTTPS hostname in production; local and example URLs are forbidden.`,
    );
  return url;
}

export function requiredPublicUrl(
  name: string,
  value: string | undefined,
  fallback: string,
  production: boolean,
): URL {
  const url = publicUrl(name, value, fallback, production);
  if (!url)
    throw new Error(`[config] ${name} is required for production builds.`);
  return url;
}
