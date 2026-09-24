import type { NextConfig } from "next";

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
const configuredApi = new URL(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4300",
);
const apiPath = configuredApi.pathname.replace(/\/+$/, "");
const apiPrefix = apiPath.endsWith("/api") ? apiPath : `${apiPath}/api`;

const nextConfig: NextConfig = {
  images: {
    // Only the public, immutable photo stream; never KYC, documents or arbitrary hosts.
    remotePatterns: [
      {
        protocol: configuredApi.protocol === "https:" ? "https" : "http",
        hostname: configuredApi.hostname,
        port: configuredApi.port,
        pathname: `${apiPrefix}/cars/photos/*`,
        search: "",
      },
    ],
  },
};

export default nextConfig;
