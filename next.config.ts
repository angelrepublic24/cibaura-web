import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import {
  API_URL,
  MEDIA_URL,
  SITE_URL,
  SENTRY_DSN,
  assertRequiredFeatures,
} from "./src/lib/config";
import { assertSameSite } from "./src/lib/deployment-policy";
import { securityHeaders } from "./src/lib/security-headers";
import { sentryBuildOptions } from "./src/lib/sentry-build";

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
  // Keep Node SDK built-ins native (Turbopack otherwise emits node:inspector
  // filenames which cannot be copied into standalone on Windows).
  serverExternalPackages: ["@sentry/nextjs"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(
          configuredApi,
          Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()),
          process.env.NODE_ENV !== "production",
          SENTRY_DSN,
        ),
      },
    ];
  },
  /**
   * THE SUPPORT URL AND ITS TWO GUESSES. `/support` is the page the App Store
   * and Play listings point their mandatory Support field at; `/help` and
   * `/contact` are what a person types when looking for it, and all three
   * returned 404. This is a redirect, not the `rewrites()` proxy ruled out
   * above: nothing is proxied and no cookie crosses a domain.
   *
   * 307, NOT 308. Neither path ever had content, so there is nothing for a
   * crawler to consolidate — and a permanent redirect is cached by browsers
   * and crawlers indefinitely, which would make a real help centre at `/help`
   * unreachable later for everyone who had already followed this one.
   *
   * The destination is spelled out rather than imported from `SUPPORT_PATH`
   * (`src/shared/config/support.ts`): this file is loaded without the `@/*`
   * path aliases that module's own imports use. Keep the two in step.
   */
  async redirects() {
    return [
      { source: "/help", destination: "/support", permanent: false },
      { source: "/contact", destination: "/support", permanent: false },
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
  if (phase === PHASE_PRODUCTION_BUILD && !SENTRY_DSN)
    console.warn(
      "[monitoring] NEXT_PUBLIC_SENTRY_DSN is missing: this build will NOT report errors. Staging/development only.",
    );
  return withSentryConfig(
    {
      ...nextConfig,
      ...(developmentBuild
        ? {
            distDir: ".next-ci",
            experimental: { allowDevelopmentBuild: true },
          }
        : {}),
    },
    sentryBuildOptions(process.env, phase === PHASE_PRODUCTION_BUILD),
  );
}
