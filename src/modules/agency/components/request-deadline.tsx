"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Re-render cadence for the countdown (ms). */
const TICK_MS = 30_000;
/** Below this remaining time the badge turns urgent. */
const URGENT_MS = 3 * 3_600_000;

/** "2d 4h" / "5h 12m" / "38m" — coarse, human countdown. */
function formatRemaining(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Countdown badge for a pending booking request: the server auto-expires
 * requests at `expiresAt` (a cron sweeps every few minutes), so the inbox
 * shows how long the agency has left to respond. Urgent (warning) styling
 * under 3 hours; once past the deadline it reads "expiring soon" — the row
 * disappears whenever the sweep actually flips it to `expired`.
 *
 * Renders nothing without a deadline (non-`requested` rows send null).
 */
export function RequestDeadline({
  expiresAt,
}: {
  expiresAt: string | null | undefined;
}) {
  // Tick so the countdown stays honest while the tab is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) return null;
  const deadline = new Date(expiresAt).getTime();
  if (Number.isNaN(deadline)) return null;

  const remaining = deadline - now;
  const overdue = remaining <= 0;
  const urgent = !overdue && remaining <= URGENT_MS;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        overdue && "border-destructive/30 bg-destructive/10 text-destructive",
        urgent && "border-warning/30 bg-warning-soft text-warning",
        !overdue && !urgent && "border-border bg-muted text-muted-foreground",
      )}
      title={`Auto-expires ${new Date(expiresAt).toLocaleString()}`}
    >
      <Clock className="h-3 w-3" />
      {overdue ? "Expiring soon" : `Expires in ${formatRemaining(remaining)}`}
    </span>
  );
}
