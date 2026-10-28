"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * "I agree to the Terms of Service and Privacy Policy" checkbox shared by
 * register, password reset and request-to-book. Purely presentational: the
 * caller owns the form state (react-hook-form `register("acceptTerms")`)
 * and passes `disabled` while `GET /legal/current` is still loading, so a
 * consent can never be recorded against an unknown terms version.
 */
export function TermsCheckbox({
  id,
  inputProps,
  disabled,
  error,
  hint,
  label,
  className,
}: {
  id: string;
  /** Spread of `form.register("acceptTerms")` (or a controlled `{ checked, onChange }`). */
  inputProps: React.ComponentProps<"input">;
  disabled?: boolean;
  error?: string;
  /** Extra line under the label (e.g. "Loading the current terms…"). */
  hint?: ReactNode;
  /** Defaults to the standard consent sentence. */
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex items-start gap-2.5 text-sm text-foreground",
          disabled && "opacity-60",
        )}
      >
        <input
          id={id}
          type="checkbox"
          disabled={disabled}
          aria-invalid={!!error}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          {...inputProps}
        />
        <span>
          {label ?? (
            <>
              I agree to the{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </>
          )}
        </span>
      </label>
      {hint ? <p className="pl-6.5 text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
