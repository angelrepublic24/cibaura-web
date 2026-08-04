"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import { agencyCarFiltersToSearchParams } from "@/features/agencies/filters";
import { CarCard } from "@/features/cars/components/car-card";
import { CarFiltersPanel } from "@/features/cars/components/car-filters-panel";
import { StarRating } from "@/shared/components/star-rating";
import { FavoriteButton } from "@/shared/components/favorite-button";
import { type AgencyVerificationStatus } from "@/shared/types/domain";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * Public agency storefront: header (identity + verified badge + footprint)
 * + a filter bar + the photo-forward car grid. Filters are held in local
 * state and committed to the query; the query key is derived from
 * (slug, filters), so every change is its own cache entry.
 */
export function AgencyProfile({
  slug,
  filters,
}: {
  slug: string;
  filters: AgencyCarsFilters;
}) {
  const router = useRouter();

  const profileQuery = useQuery({
    queryKey: agencyProfileKeys.profile(slug),
    queryFn: () => AgenciesApi.profile(slug),
  });

  // URL is the source of truth — a filter change rewrites the query string and
  // the grid's TanStack key is derived from `filters` (back/forward re-search).
  function applyFilters(next: AgencyCarsFilters) {
    const qs = agencyCarFiltersToSearchParams({
      ...next,
      page: undefined,
    }).toString();
    router.replace(
      `/agencies/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`,
    );
  }

  function goToPage(page: number) {
    const qs = agencyCarFiltersToSearchParams({ ...filters, page }).toString();
    router.replace(`/agencies/${encodeURIComponent(slug)}?${qs}`);
  }

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
        agencyId={agency.id}
      />

      {/* Reviews up top — easy to find before browsing the fleet. */}
      <AgencyReviews slug={slug} reviewCount={agency.reviewCount} />

      <div className="mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          {/* The SAME faceted filter panel as the car search. Branch + sort are
              separate axes, not vehicle facets — preserve them across the
              panel's Apply / Clear all so the location choice isn't lost. */}
          <CarFiltersPanel
            filters={filters}
            onApply={(f) =>
              applyFilters({
                ...f,
                branchId: filters.branchId,
                sort: filters.sort,
              })
            }
          />
        </aside>
        <section className="space-y-4">
          {agency.branches.length > 1 ? (
            <LocationPicker
              branches={agency.branches}
              value={filters.branchId}
              onChange={(branchId) =>
                applyFilters({ ...filters, branchId })
              }
            />
          ) : null}
          <AgencyCarsGrid
            slug={slug}
            filters={filters}
            onApply={applyFilters}
            onPage={goToPage}
          />
        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ location picker

function LocationPicker({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; name: string; city: { id: string; name: string } | null }[];
  value?: string;
  onChange: (branchId: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius)] border border-border bg-surface p-3 shadow-sm">
      <MapPin className="h-4 w-4 shrink-0 text-primary" />
      <Label htmlFor="ap-branch" className="whitespace-nowrap text-sm">
        Location
      </Label>
      <Select
        id="ap-branch"
        className="h-9"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">All locations</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.city ? ` — ${b.city.name}` : ""}
          </option>
        ))}
      </Select>
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
  agencyId,
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
  agencyId: string;
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
          <FavoriteButton agencyId={agencyId} className="mb-1 ml-auto" />
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

// --------------------------------------------------------------- cars grid

function AgencyCarsGrid({
  slug,
  filters,
  onApply,
  onPage,
}: {
  slug: string;
  filters: AgencyCarsFilters;
  onApply: (next: AgencyCarsFilters) => void;
  onPage: (page: number) => void;
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
                onClick={() => onPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext}
                onClick={() => onPage(page + 1)}
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
  const [expanded, setExpanded] = useState(false);

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
    <section className="mt-8 border-t border-border pt-8">
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
              {(expanded
                ? query.data!.items
                : query.data!.items.slice(0, 3)
              ).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>

            {!expanded && total > 3 ? (
              <div className="mt-5 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded(true)}
                >
                  See all {total} reviews
                </Button>
              </div>
            ) : null}

            {expanded && (page > 1 || hasNext) && (
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
