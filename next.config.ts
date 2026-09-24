import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import {
  API_URL,
  MEDIA_URL,
  SITE_URL,
  assertRequiredFeatures,
} from "./src/lib/config";
import { assertSameSite } from "./src/lib/deployment-policy";
import { securityHeaders } from "./src/lib/security-headers";

/**
 * SESSION / DEPLOYMENT NOTE (ADR-0006, audit WEB-04): the web session rides in
 * httpOnly `SameSite=Lax` cookies set by the API. Browsers attach those cookies
 * to XHR/fetch ONLY when this site and the API share the same registrable
 * domain (eTLD+1) — e.g. `https://cibaura.com` + `https://api.cibaura.com`.
 * A web on `*.vercel.app` talking to an API on `*.onrender.com` would log in
 * "successfully" and then 401 on every request. There is deliberately NO
 * `rewrites()` proxy here: the API validates the domain pair at boot
 * (`API_PUBLIC_URL` vs `FRONTEND_URL`), so deploy both under one domain.
 */
const configuredApi = new URL(API_URL);
if (process.env.NODE_ENV === "production") {
  assertSameSite(SITE_URL, configuredApi);
  assertRequiredFeatures(
    process.env.ALLOW_DEFAULT_LEGAL === "true",
    process.env.ALLOW_MISSING_MAPS === "true",
  );
}
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(
          configuredApi,
          Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
          process.env.NODE_ENV !== "production",
        ),
      },
    ];
  },
  images: {
    // Only the public, immutable photo stream; never KYC, documents or arbitrary hosts.
    remotePatterns: [
      {
        protocol: configuredApi.protocol === "https:" ? "https" : "http",
        hostname: configuredApi.hostname,
        port: configuredApi.port,
        pathname: `${configuredApi.pathname}/cars/photos/*`,
        search: "",
      },
      ...(MEDIA_URL
        ? [
            {
              protocol:
                MEDIA_URL.protocol === "https:"
                  ? ("https" as const)
                  : ("http" as const),
              hostname: MEDIA_URL.hostname,
              port: MEDIA_URL.port,
              pathname: `${MEDIA_URL.pathname}**`,
            },
          ]
        : []),
    ],
  },
};

export default function config(phase: string): NextConfig {
  const developmentBuild =
    phase === PHASE_PRODUCTION_BUILD && process.env.NODE_ENV === "development";
  return {
    ...nextConfig,
    ...(developmentBuild
      ? {
          distDir: ".next-ci",
          experimental: { allowDevelopmentBuild: true },
        }
      : {}),
  };
}
