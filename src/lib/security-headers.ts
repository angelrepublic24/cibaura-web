/** Static CSP preserves prerendering; inline hydration/styles require unsafe-inline.
 * Maps' documented allowlist requires unsafe-eval, enabled only when Maps is used.
 * This is an enforced baseline, not a nonce-based strict CSP.
 */
export function securityHeaders(
  api: URL,
  mapsEnabled: boolean,
  development: boolean,
) {
  const mapsScripts = mapsEnabled
    ? " https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com blob:"
    : "";
  const mapsConnections = mapsEnabled
    ? " https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:"
    : "";
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${development || mapsEnabled ? " 'unsafe-eval'" : ""} https://js.stripe.com https://*.js.stripe.com${mapsScripts}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Existing external photos deliberately retain their direct-loading fallback.
    `img-src 'self' https: data: blob:${development ? " http:" : ""}`,
    `connect-src 'self' ${api.origin} https://api.stripe.com https://maps.googleapis.com https://link.com https://*.link.com${mapsConnections}${development ? " ws: wss:" : ""}`,
    `frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com${mapsEnabled ? " https://*.google.com" : ""}`,
    "worker-src 'self' blob:",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        'camera=(self), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com" "https://hooks.stripe.com")',
    },
  ];
}
