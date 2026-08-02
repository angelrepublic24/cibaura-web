import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Styled NATIVE select (keeps the skeleton dependency-free; can be
 * swapped for the Radix-based shadcn Select later without changing
 * call sites much).
 */
function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full appearance-none rounded-[var(--radius-sm)] border border-border bg-surface bg-[length:1.1rem] bg-[right_0.7rem_center] bg-no-repeat px-3.5 py-2 pr-9 text-sm shadow-sm transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        // Inline chevron so the native select still reads as a dropdown.
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2378716c%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { Select };
