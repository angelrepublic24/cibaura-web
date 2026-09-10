"use client";

import { useEffect, useState } from "react";

/**
 * A ticking "now" (epoch ms) for countdowns and deadlines. Re-renders the
 * caller every `tickMs` while mounted so remaining-time copy stays honest
 * without each component owning its own interval.
 */
export function useNow(tickMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}
