import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * First-paint placeholder for the public agency storefront: identity header,
 * then the facet panel + car grid on the same
 * `lg:grid-cols-[280px_1fr]` / `sm:grid-cols-2 xl:grid-cols-3` grid as
 * `<AgencyProfile/>`.
 *
 * A `<Suspense>` fallback, NOT a route-level `loading.tsx` — see the note in
 * `car-search-skeleton.tsx`: a `loading.tsx` flushes a 200 shell before the
 * page can call `notFound()`, so an unknown agency slug answered 200 with an
 * empty page. Mounted below the page's 404 gate, the skeleton is back without
 * costing the status code.
 */
export function AgencyProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading agency">
      <Skeleton className="h-52 w-full rounded-[var(--radius-lg)]" />
      <div className="mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
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
