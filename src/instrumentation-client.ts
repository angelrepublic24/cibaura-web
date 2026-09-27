import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./lib/sentry-options";

Sentry.init(sentryOptions);
if (!sentryOptions.enabled)
  console.warn(
    "[monitoring] Sentry is not configured in this build. Client errors will not be reported.",
  );
