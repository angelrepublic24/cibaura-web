/**
 * Pure notification helpers. No API or service calls here.
 */

/**
 * Compact relative time for a feed row, e.g. "3h ago", "2d ago". Anything
 * older than a week becomes a short date, because "9d ago" stops being
 * easier to read than "Mar 4".
 */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
