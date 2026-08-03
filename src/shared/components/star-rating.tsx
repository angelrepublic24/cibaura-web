"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Read-only star display: ★★★★☆ + optional "4.5 · 12 reviews" (or "New"). */
export function StarRating({
  rating,
  count,
  size = 16,
  showValue = true,
  className,
}: {
  rating: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            style={{ width: size, height: size }}
            className={
              i <= rounded
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40"
            }
          />
        ))}
      </span>
      {showValue ? (
        count === 0 ? (
          <span className="text-xs text-muted-foreground">New</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {rating.toFixed(1)}
            {count !== undefined
              ? ` · ${count} review${count === 1 ? "" : "s"}`
              : ""}
          </span>
        )
      ) : null}
    </span>
  );
}

/** Interactive 1–5 star picker for the review form. */
export function StarPicker({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          aria-label={`${i} star${i === 1 ? "" : "s"}`}
          onMouseEnter={() => setHover(i)}
          onClick={() => onChange(i)}
          className="rounded transition-transform hover:scale-110"
        >
          <Star
            style={{ width: size, height: size }}
            className={
              i <= shown
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-muted-foreground/40"
            }
          />
        </button>
      ))}
    </div>
  );
}
