/**
 * Resolved backend API base URL.
 *
 * `NEXT_PUBLIC_API_URL` is inlined at build time. In development we fall
 * back to localhost (convenient), but a PRODUCTION build with the env
 * missing throws at module-eval, which fails `next build` LOUDLY instead
 * of shipping a bundle that points every real user at localhost.
 * (Pattern mirrored from Beusun `src/lib/config.ts`.)
 *
 * The NestJS backend mounts every route under the global prefix `api/`
 * (see backend `main.ts` → `setGlobalPrefix('api/')`), so the resolved base
 * URL always ends in `/api`. Feature modules call bare paths (`/auth/login`)
 * and this prefix makes them resolve to `…/api/auth/login`.
 */
function resolveApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url && url.trim().length > 0) return withApiPrefix(url);

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[config] NEXT_PUBLIC_API_URL is required for production builds. " +
        "Set it in the build environment (e.g. https://api.cibaura.example).",
    );
  }

  return withApiPrefix("http://localhost:4300");
}

/** Strip trailing slashes and ensure a single `/api` suffix (idempotent). */
function withApiPrefix(url: string): string {
  const base = url.trim().replace(/\/+$/, "");
  return /\/api$/.test(base) ? base : `${base}/api`;
}

export const API_URL = resolveApiUrl();
