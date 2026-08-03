"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Building2,
  CarFront,
  Clock,
  MapPin,
} from "lucide-react";
import {
  AgenciesApi,
  agencyProfileKeys,
  type AgencyCarsFilters,
  type AgencyCarsSort,
  type Review,
} from "@/features/agencies/api";
import { CarCard } from "@/features/cars/components/car-card";
import { StarRating } from "@/shared/components/star-rating";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  TRANSMISSIONS,
  type AgencyVerificationStatus,
} from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Public agency storefront: header (identity + verified badge + footprint)
 * + a filter bar + the photo-forward car grid. Filters are held in local
 * state and committed to the query; the query key is derived from
 * (slug, filters), so every change is its own cache entry.
 */
export function AgencyProfile({ slug }: { slug: string }) {
  const [filters, setFilters] = useState<AgencyCarsFilters>({});

  const profileQuery = useQuery({
    queryKey: agencyProfileKeys.profile(slug),
    queryFn: () => AgenciesApi.profile(slug),
  });

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading agency…" />;
  }
  if (profileQuery.isError) {
    return (
      <ErrorState
        title="Could not load this agency"
        message={profileQuery.error.message}
        onRetry={() => profileQuery.refetch()}
      />
    );
  }

  const agency = profileQuery.data!;

  return (
    <div>
      <AgencyHeader
        name={agency.name}
        description={agency.description}
        logoUrl={agency.logoUrl}
        verificationStatus={agency.verificationStatus}
        cities={agency.cities}
        branchCount={agency.branchCount}
        carCount={agency.carCount}
        ratingAvg={agency.ratingAvg}
        reviewCount={agency.reviewCount}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <AgencyFilters
            filters={filters}
            onApply={setFilters}
          />
        </aside>
        <section>
          <AgencyCarsGrid slug={slug} filters={filters} onApply={setFilters} />
        </section>
      </div>

      <AgencyReviews slug={slug} reviewCount={agency.reviewCount} />
    </div>
  );
}

// ------------------------------------------------------------------ header

function AgencyHeader({
  name,
  description,
  logoUrl,
  verificationStatus,
  cities,
  branchCount,
  carCount,
  ratingAvg,
  reviewCount,
}: {
  name: string;
  description?: string;
  logoUrl?: string;
  verificationStatus: AgencyVerificationStatus;
  cities: { id: string; name: string }[];
  branchCount: number;
  carCount: number;
  ratingAvg: number;
  reviewCount: number;
}) {
  return (
    <header className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm">
      {/* Warm banner strip. */}
      <div className="h-24 bg-gradient-to-r from-accent-soft to-muted md:h-28" />
      <div className="px-6 pb-6">
        <div className="-mt-10 flex flex-wrap items-end gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={name}
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <CarFront className="h-9 w-9 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl text-foreground">{name}</h1>
              <VerificationBadge status={verificationStatus} />
            </div>
            <div className="mt-1.5">
              <StarRating rating={ratingAvg} count={reviewCount} />
            </div>
          </div>
        </div>

        {description ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}

        {/* Footprint stats. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CarFront className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{carCount}</span> cars
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">{branchCount}</span>{" "}
            branch{branchCount === 1 ? "" : "es"}
          </span>
          {cities.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {cities.map((c) => c.name).join(", ")}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function VerificationBadge({ status }: { status: AgencyVerificationStatus }) {
  if (status === "verified") {
    return (
      <Badge variant="success">
        <BadgeCheck className="h-3.5 w-3.5" />
        Verified agency
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning">
        <Clock className="h-3.5 w-3.5" />
        Pending verification
      </Badge>
    );
  }
  return <Badge variant="secondary">Unverified</Badge>;
}

// -------------------------------------------------------------- filter bar

const SORTS: { value: AgencyCarsSort; label: string }[] = [
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "year_desc", label: "Newest first" },
];

function AgencyFilters({
  filters,
  onApply,
}: {
  filters: AgencyCarsFilters;
  onApply: (next: AgencyCarsFilters) => void;
}) {
  const [draft, setDraft] = useState<AgencyCarsFilters>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  function set<K extends keyof AgencyCarsFilters>(
    key: K,
    value: AgencyCarsFilters[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <form
      className="space-y-4 rounded-[var(--radius)] border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24"
      onSubmit={(e) => {
        e.preventDefault();
        onApply({ ...draft, page: undefined });
      }}
    >
      <h2 className="text-base font-semibold text-foreground">
        Filter this agency
      </h2>

      <div className="space-y-1.5">
        <Label htmlFor="af-category">Category</Label>
        <Select
          id="af-category"
          value={draft.category ?? ""}
          onChange={(e) => set("category", e.target.value || undefined)}
        >
          <option value="">Any category</option>
          {CAR_CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="af-make">Make</Label>
          <Input
            id="af-make"
            placeholder="Toyota"
            value={draft.make ?? ""}
            onChange={(e) => set("make", e.target.value || undefined)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="af-model">Model</Label>
          <Input
            id="af-model"
            placeholder="Corolla"
            value={draft.model ?? ""}
            onChange={(e) => set("model", e.target.value || undefined)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="af-color">Color</Label>
          <Select
            id="af-color"
            value={draft.color ?? ""}
            onChange={(e) => set("color", e.target.value || undefined)}
          >
            <option value="">Any</option>
            {CAR_COLORS.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="af-transmission">Transmission</Label>
          <Select
            id="af-transmission"
            value={draft.transmission ?? ""}
            onChange={(e) => set("transmission", e.target.value || undefined)}
          >
            <option value="">Any</option>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="af-year">Year (from)</Label>
        <Input
          id="af-year"
          type="number"
          inputMode="numeric"
          placeholder="2020"
          value={draft.year ?? ""}
          onChange={(e) =>
            set("year", e.target.value ? Number(e.target.value) : undefined)
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="af-price-min">Price min</Label>
          <Input
            id="af-price-min"
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={draft.priceMin ?? ""}
            onChange={(e) =>
              set(
                "priceMin",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="af-price-max">Price max</Label>
          <Input
            id="af-price-max"
            type="number"
            inputMode="numeric"
            placeholder="200"
            value={draft.priceMax ?? ""}
            onChange={(e) =>
              set(
                "priceMax",
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" className="flex-1">
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={() => onApply({})}>
          Clear
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- cars grid

function AgencyCarsGrid({
  slug,
  filters,
  onApply,
}: {
  slug: string;
  filters: AgencyCarsFilters;
  onApply: (next: AgencyCarsFilters) => void;
}) {
  const query = useQuery({
    queryKey: agencyProfileKeys.cars(slug, filters),
    queryFn: () => AgenciesApi.cars(slug, filters),
  });

  const total = query.data?.total ?? 0;
  const page = filters.page ?? 1;
  const pageSize = query.data?.pageSize ?? 12;
  const hasNext = page * pageSize < total;

  return (
    <div>
      {/* Toolbar: result count + sort. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <p className="text-sm text-muted-foreground">
          {query.data ? (
            <>
              <span className="font-medium text-foreground">{total}</span> car
              {total === 1 ? "" : "s"}
            </>
          ) : (
            "Cars"
          )}
        </p>
        <div className="flex items-center gap-2">
          <Label htmlFor="af-sort" className="normal-case">
            Sort
          </Label>
          <Select
            id="af-sort"
            className="h-9 w-auto"
            value={filters.sort ?? ""}
            onChange={(e) =>
              onApply({
                ...filters,
                sort: (e.target.value || undefined) as
                  | AgencyCarsSort
                  | undefined,
                page: undefined,
              })
            }
          >
            <option value="">Recommended</option>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Could not load cars"
          message={query.error.message}
          onRetry={() => query.refetch()}
        />
      ) : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title="No cars match these filters"
          description="Try clearing some filters to see this agency's full fleet."
          action={
            <Button variant="outline" onClick={() => onApply({})}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {query.data!.items.map((car) => (
              <CarCard
                key={car.id}
                car={car}
                href={`/agencies/${slug}/cars/${car.id}`}
              />
            ))}
          </div>

          {(page > 1 || hasNext) && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onApply({ ...filters, page: page - 1 })}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => onApply({ ...filters, page: page + 1 })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- reviews

function AgencyReviews({
  slug,
  reviewCount,
}: {
  slug: string;
  reviewCount: number;
}) {
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: agencyProfileKeys.reviews(slug, page),
    queryFn: () => AgenciesApi.reviews(slug, page),
  });

  // No reviews at all: skip the whole section rather than show an empty shell.
  if (reviewCount === 0 && !query.isLoading) {
    return null;
  }

  const total = query.data?.total ?? reviewCount;
  const pageSize = query.data?.pageSize ?? 10;
  const hasNext = page * pageSize < total;

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-display text-2xl text-foreground">
        Reviews
        {total > 0 ? (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({total})
          </span>
        ) : null}
      </h2>

      <div className="mt-5">
        {query.isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-sm"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState
            title="Could not load reviews"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.items.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <>
            <ul className="space-y-4">
              {query.data!.items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>

            {(page > 1 || hasNext) && (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <li className="rounded-[var(--radius)] border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {review.reviewerName}
          </span>
          <StarRating rating={review.rating} showValue={false} size={14} />
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </div>
      {review.comment ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {review.comment}
        </p>
      ) : null}
    </li>
  );
}
