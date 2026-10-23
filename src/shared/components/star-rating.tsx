"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only star display: ★★★★☆ + optional "4.5 · 12 reviews".
 *
 * TOTAL BY CONSTRUCTION. `rating` and `count` come straight off a wire
 * payload, and a payload that predates the fields — a response still in
 * Next's fetch cache, a client talking to an older API, a car list from a
 * surface that was never updated — hands this `undefined`.
 *
 * It used to crash on exactly that, and not quietly: `count === 0` is false
 * for `undefined`, so it fell through to `rating.toFixed(1)` and took down
 * the whole page with a 500. A STAR DISPLAY MUST NOT BE ABLE TO 500 A
 * PUBLIC PAGE. Anything that is not a real number now reads as "no reviews
 * yet", which is both honest and the state those payloads are actually in.
 */
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
  const safeRating = Number.isFinite(rating) ? rating : 0;
  const reviewCount = Number.isFinite(count) ? (count as number) : 0;
  const rounded = Math.round(safeRating);
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
        reviewCount === 0 ? (
          // NOT "New". On a car card this sits two lines under the model
          // year, where "New" reads as "new car" rather than "new host".
          <span className="text-xs text-muted-foreground">No reviews yet</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {safeRating.toFixed(1)}
            {` · ${reviewCount} review${reviewCount === 1 ? "" : "s"}`}
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
