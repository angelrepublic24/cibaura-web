"use client";

import { ErrorState } from "@/shared/components/states";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ErrorState
        title="Unexpected error"
        message={error.message}
        onRetry={reset}
      />
    </div>
  );
}
