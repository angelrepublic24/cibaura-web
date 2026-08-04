import Link from "next/link";
import { Building2, Car } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cars ⇄ Agencies search switch — the way to reach agency search is FROM the
 * search filter (there is no "Agencies" nav link). Both sides are city-scoped;
 * the active side is inert so it never drops the current dates/filters.
 */
export function SearchModeToggle({
  mode,
  city,
}: {
  mode: "cars" | "agencies";
  city?: string;
}) {
  const c = city && city !== "all" ? city : undefined;
  const carsHref = `/cars/${c ?? "all"}`;
  const agenciesHref = c ? `/agencies?city=${encodeURIComponent(c)}` : "/agencies";

  const base =
    "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors";
  const active = "bg-primary text-primary-foreground";
  const idle = "text-muted-foreground hover:bg-muted";

  return (
    <div className="inline-flex w-full overflow-hidden rounded-md border border-border">
      {mode === "cars" ? (
        <span className={cn(base, active)}>
          <Car className="h-4 w-4" /> Cars
        </span>
      ) : (
        <Link href={carsHref} className={cn(base, idle)}>
          <Car className="h-4 w-4" /> Cars
        </Link>
      )}
      {mode === "agencies" ? (
        <span className={cn(base, active, "border-l border-border")}>
          <Building2 className="h-4 w-4" /> Agencies
        </span>
      ) : (
        <Link href={agenciesHref} className={cn(base, idle, "border-l border-border")}>
          <Building2 className="h-4 w-4" /> Agencies
        </Link>
      )}
    </div>
  );
}
