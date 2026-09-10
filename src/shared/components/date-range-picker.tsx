"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Inline rental date-range picker with BLOCKED days.
 *
 * Semantics mirror the wire (`Period`, half-open `[start, end)`): the
 * customer keeps the car on `from … to-1` and returns it ON `to`. A day is
 * "blocked" when the server says the car is occupied that day. Therefore:
 *  - a blocked day can never be the pickup day;
 *  - the return day must satisfy: no blocked day inside `[from, to)`. The
 *    first blocked day after `from` IS a valid return day (the car goes back
 *    the morning the next rental starts) and is drawn as such;
 *  - past days, days outside `[minDate, maxDate]` are disabled.
 *
 * The component never decides availability — it only renders the periods
 * the server returned (`isDayBlocked`); the server quote/request has the
 * final word on any conflict.
 */
export interface DateRange {
  from: string; // YYYY-MM-DD, "" when unset
  to: string; // YYYY-MM-DD exclusive, "" when unset
}

export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  isDayBlocked,
  className,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  /** Earliest selectable day (YYYY-MM-DD, inclusive). */
  minDate: string;
  /** Latest selectable day (YYYY-MM-DD, inclusive) — the availability window. */
  maxDate: string;
  isDayBlocked: (iso: string) => boolean;
  className?: string;
}) {
  const [month, setMonth] = useState(() =>
    (value.from || minDate).slice(0, 7),
  );
  /** Picking phase: after a pickup click we wait for the return click. */
  const [picking, setPicking] = useState<"from" | "to">(
    value.from && !value.to ? "to" : "from",
  );
  const [hover, setHover] = useState<string | null>(null);

  const monthMin = minDate.slice(0, 7);
  const monthMax = maxDate.slice(0, 7);
  const canPrev = month > monthMin;
  const canNext = month < monthMax;

  const days = useMemo(() => monthGrid(month), [month]);

  /** A day is a legal RETURN for the current `from` if `[from, day)` is free. */
  function isValidReturn(from: string, day: string): boolean {
    if (day <= from) return false;
    for (let d = from; d < day; d = addDaysIso(d, 1)) {
      if (isDayBlocked(d)) return false;
    }
    return true;
  }

  function pick(day: string) {
    if (picking === "from") {
      onChange({ from: day, to: "" });
      setPicking("to");
      return;
    }
    // picking === "to"
    if (!value.from || day <= value.from) {
      // Clicking before/at the pickup restarts the selection from there.
      if (!isDayBlocked(day)) {
        onChange({ from: day, to: "" });
      }
      return;
    }
    if (!isValidReturn(value.from, day)) return;
    onChange({ from: value.from, to: day });
    setPicking("from");
  }

  const previewTo = picking === "to" && hover && value.from ? hover : value.to;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-sm)] border border-border bg-surface p-3",
        className,
      )}
      role="group"
      aria-label="Rental dates"
    >
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Previous month"
          disabled={!canPrev}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {formatMonth(month)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
        {days.map((iso, i) => {
          if (!iso) return <span key={`pad-${i}`} />;
          const blocked = isDayBlocked(iso);
          const outOfWindow = iso < minDate || iso > maxDate;
          const pickingReturn = picking === "to" && !!value.from;
          const validReturnBoundary =
            pickingReturn && isValidReturn(value.from, iso);
          // Pickup phase: any free day. Return phase: a legal return day, or
          // a free day on/before the pickup (re-click restarts the selection).
          const disabled =
            outOfWindow ||
            (pickingReturn
              ? !(validReturnBoundary || (!blocked && iso <= value.from))
              : blocked);
          const isFrom = iso === value.from;
          const isTo = iso === value.to;
          const inRange =
            !!value.from && !!previewTo && iso > value.from && iso < previewTo;
          const dayNumber = Number(iso.slice(8, 10));

          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              aria-disabled={disabled}
              aria-pressed={isFrom || isTo}
              aria-label={`${formatLong(iso)}${blocked ? " (unavailable)" : ""}`}
              title={
                blocked
                  ? validReturnBoundary
                    ? "Unavailable from this day — you can return the car this morning"
                    : "Unavailable"
                  : undefined
              }
              onMouseEnter={() => setHover(iso)}
              onFocus={() => setHover(iso)}
              onClick={() => pick(iso)}
              className={cn(
                "relative h-9 rounded-[var(--radius-sm)] text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                !disabled && !isFrom && !isTo && "hover:bg-muted",
                inRange && "bg-accent-soft text-accent-soft-foreground",
                (isFrom || isTo) &&
                  "bg-primary font-semibold text-primary-foreground",
                blocked &&
                  !isFrom &&
                  !isTo &&
                  "bg-[repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(220,38,38,0.18)_3px,rgba(220,38,38,0.18)_6px)] text-red-700/70",
                disabled && "cursor-not-allowed opacity-40",
                outOfWindow && "opacity-25",
              )}
            >
              {dayNumber}
              {blocked && !isFrom && !isTo ? (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-red-500" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[repeating-linear-gradient(135deg,transparent,transparent_2px,rgba(220,38,38,0.35)_2px,rgba(220,38,38,0.35)_4px)]" />
          Unavailable
        </span>
        <span>
          {picking === "from"
            ? "Select your pickup day"
            : "Now select the return day"}
        </span>
      </div>
    </div>
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** 42-cell Monday-first grid for a `YYYY-MM` month; empty strings pad. */
function monthGrid(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const cells: string[] = [];
  for (let i = 0; i < lead; i++) cells.push("");
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push("");
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Add N days to a YYYY-MM-DD string (UTC-safe; display/selection only). */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Build the `isDayBlocked` predicate from the server's occupied periods
 * (`[start, end)`): a day is blocked when some period contains it.
 */
export function blockedDayPredicate(
  occupied: readonly { start: string; end: string }[],
): (iso: string) => boolean {
  return (iso) => occupied.some((p) => p.start <= iso && iso < p.end);
}
