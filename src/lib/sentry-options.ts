import type { ErrorEvent } from "@sentry/nextjs";
import { BUILD_SHA, SENTRY_DSN, STRIPE_PUBLISHABLE_KEY } from "./config";

/** Retain exception/stack diagnostics, never session cookies or request payloads. */
export function sanitizeErrorEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  delete event.extra;
  if (event.request) {
    const { url, method } = event.request;
    event.request = { method, url: url?.split(/[?#]/)[0] };
  }
  return event;
}

export const sentryOptions = {
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  release: BUILD_SHA ?? undefined,
  environment: STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")
    ? "production"
    : "staging",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  maxBreadcrumbs: 0,
  beforeSend: sanitizeErrorEvent,
};
