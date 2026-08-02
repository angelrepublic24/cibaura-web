import { Skeleton } from "@/shared/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
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
