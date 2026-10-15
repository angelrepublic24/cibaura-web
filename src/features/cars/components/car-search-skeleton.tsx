import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * First-paint placeholder for the `/cars/[city]` results region: title, the
 * destination + dates bar, the facet panel and six car cards, laid out on the
 * SAME `lg:grid-cols-[280px_1fr]` / `sm:grid-cols-2 xl:grid-cols-3` grid as
 * `<CarSearchResults/>` so the swap costs no layout shift.
 *
 * This is a `<Suspense>` fallback, NOT a route-level `loading.tsx`. A
 * `loading.tsx` wraps the whole route segment, which flushes a 200 shell
 * before the page body can call `notFound()` — the city page then answered
 * every made-up slug with "200 and empty", the one thing worse for search
 * than a clean 404. Mounted below the page's 404 gate instead, the skeleton
 * comes back and the status code stays honest.
 *
 * Deliberately free of real text: the fallback markup also sits in the raw
 * byte stream for clients that stream, and a placeholder heading there would
 * duplicate the real <h1> that arrives moments later.
 */
export function CarSearchSkeleton() {
  return (
    <div role="status" aria-label="Loading cars">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-5 h-20 w-full rounded-[var(--radius)]" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-96 rounded-[var(--radius)]" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-[var(--radius)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
