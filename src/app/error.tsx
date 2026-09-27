"use client";

import { useEffect } from "react";
import { captureException } from "@sentry/nextjs";

import { ErrorState } from "@/shared/components/states";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState
        title="Unexpected error"
        message="We couldn't load this page. Please try again. If the problem continues, come back in a few minutes."
        onRetry={reset}
      />
    </div>
  );
}
