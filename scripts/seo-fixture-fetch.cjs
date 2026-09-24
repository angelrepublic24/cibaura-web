// Test-only preload. Used exclusively by seo-smoke.mjs in a temporary build copy.
// Neither imported nor bundled by the application.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === process.env.SEO_SMOKE_SOURCE_ORIGIN) {
    const destination = new URL(
      url.pathname + url.search,
      process.env.SEO_SMOKE_FIXTURE_ORIGIN,
    );
    const redirected =
      input instanceof Request ? new Request(destination, input) : destination;
    return originalFetch(redirected, init);
  }
  return originalFetch(input, init);
};
