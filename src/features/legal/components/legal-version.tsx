"use client";

import { useLegalCurrent } from "@/features/legal/hooks";
import { LEGAL } from "@/shared/config/legal";

/**
 * "Version YYYY-MM-DD" line for the legal pages — sourced from the backend
 * (`GET /legal/current`) so the page always states the version users are
 * actually asked to accept; falls back to the build-time constant while
 * loading or when the API is unreachable.
 */
export function LegalVersion() {
  const query = useLegalCurrent();
  const version = query.data?.termsVersion ?? LEGAL.termsVersionFallback;
  return (
    <p className="text-sm text-muted-foreground">
      Version {version}
      <span className="text-muted-foreground/70"> · effective on that date</span>
    </p>
  );
}
