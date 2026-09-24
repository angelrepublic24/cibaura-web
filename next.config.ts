import type { NextConfig } from "next";
import { API_URL, MEDIA_URL } from "./src/lib/config";

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
const nextConfig: NextConfig = {
  output: "standalone",
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

export default nextConfig;
