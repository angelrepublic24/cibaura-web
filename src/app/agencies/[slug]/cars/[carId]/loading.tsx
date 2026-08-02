import { Skeleton } from "@/shared/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="aspect-[16/10] w-full rounded-[var(--radius-lg)]" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-[var(--radius-sm)]" />
            ))}
          </div>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-28 w-full rounded-[var(--radius)]" />
        </div>
        <Skeleton className="h-[28rem] rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
