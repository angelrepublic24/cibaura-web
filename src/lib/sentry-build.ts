import type { SentryBuildOptions } from "@sentry/nextjs/config";

/** Build-only secret policy. Never import this module from application code. */
export function sentryBuildOptions(
  env: Record<string, string | undefined>,
  isBuild: boolean,
  warn: (message: string) => void = console.warn,
): SentryBuildOptions {
  const authToken = env.SENTRY_AUTH_TOKEN?.trim();
  const org = env.SENTRY_ORG?.trim();
  const project = env.SENTRY_PROJECT?.trim();
  const missing = [
    !authToken && "SENTRY_AUTH_TOKEN",
    !org && "SENTRY_ORG",
    !project && "SENTRY_PROJECT",
  ].filter(Boolean);
  const required =
    isBuild &&
    env.NODE_ENV === "production" &&
    env.NEXT_PUBLIC_STRIPE_ALLOW_TEST_KEY !== "true";
  if (required && missing.length)
    throw new Error(
      `[sentry-build] Production source maps require ${missing.join(", ")}.`,
    );
  const upload =
    isBuild && env.NODE_ENV === "production" && missing.length === 0;
  if (isBuild && !upload)
    warn(
      "[sentry-build] Source maps will NOT be uploaded. Client stacks may be minified. Staging/development only.",
    );
  return {
    authToken: upload ? authToken : undefined,
    org: upload ? org : undefined,
    project: upload ? project : undefined,
    telemetry: false,
    silent: false,
    // Error reporting only: navigation tracing is intentionally disabled in the SDK.
    suppressOnRouterTransitionStartWarning: true,
    widenClientFileUpload: true,
    useRunAfterProductionCompileHook: true,
    sourcemaps: { disable: !upload, deleteSourcemapsAfterUpload: true },
    release: {
      name: env.NEXT_PUBLIC_BUILD_SHA,
      create: upload,
      finalize: upload,
    },
    // Do not turn upload failures into successful, unreadable releases or log secrets.
    errorHandler: () => {
      throw new Error("Sentry source map upload failed; build aborted.");
    },
  };
}
