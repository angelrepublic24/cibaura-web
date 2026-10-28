/**
 * Pure legal helpers. The policy numbers are DATA from `GET /legal/current`,
 * never literals in copy — these only turn one into English.
 */

/** "24 hours" / "1 hour". */
export function formatHours(hours: number): string {
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/** "3 days" / "1 day". */
export function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}
