"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, ExternalLink } from "lucide-react";
import { AdminApi, adminKeys, type AdminAgencyRow } from "@/features/admin/api";
import type { AgencyVerificationStatus } from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { StarRating } from "@/shared/components/star-rating";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * /admin/agencies — the platform-wide agencies directory (all statuses).
 *
 * Unlike /admin/agency-applications (the KYC review QUEUE, one status at a
 * time), this is the read-only master list of every agency the platform knows
 * about — verified, pending, or rejected — with their footprint (cities,
 * branches, cars), rating, and a jump to their public storefront. Admins pick
 * a status filter ("all" by default) and page through the results. The /admin
 * layout already gates platform_admin; we wrap again defensively.
 */

const PAGE_SIZE = 20;

/** The status filter adds an "all" option on top of the persisted statuses. */
type StatusFilter = "all" | AgencyVerificationStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

/** ISO datetime (createdAt) → "Aug 1, 2026". */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: AgencyVerificationStatus }) {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "rejected")
    return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export default function AdminAgenciesPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: adminKeys.agencies({
      status: status === "all" ? undefined : status,
      page,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () =>
      AdminApi.listAgencies({
        status: status === "all" ? undefined : status,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const agencies = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize ?? PAGE_SIZE;
  const hasNext = page * pageSize < total;

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1); // A new filter yields a new result set — restart at page 1.
  }

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">Agencies</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every agency on the platform across all statuses — their
              footprint, rating, and a link to each public storefront.
            </p>
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="status-filter" className="text-xs">
              Status
            </Label>
            <Select
              id="status-filter"
              value={status}
              onChange={(e) => changeStatus(e.target.value as StatusFilter)}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6">
          {query.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <ErrorState
              title="Could not load agencies"
              message={(query.error as Error).message}
              onRetry={() => query.refetch()}
            />
          ) : agencies.length === 0 ? (
            <EmptyState
              title={
                status === "all"
                  ? "No agencies yet"
                  : `No ${status} agencies`
              }
              description="Nothing to show for this filter."
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} agenc{total === 1 ? "y" : "ies"}
              </p>

              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">Agency</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Cities</th>
                        <th className="px-4 py-3 text-right font-medium">
                          Branches
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Cars
                        </th>
                        <th className="px-4 py-3 font-medium">Rating</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Storefront</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {agencies.map((a) => (
                        <AgencyRow key={a.id} agency={a} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {(page > 1 || hasNext) && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
      </div>
    </RoleGuard>
  );
}

function AgencyRow({ agency }: { agency: AdminAgencyRow }) {
  return (
    <tr className="align-middle transition-colors hover:bg-muted/40">
      {/* Agency identity */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {agency.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              /{agency.slug}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={agency.verificationStatus} />
      </td>

      {/* Cities */}
      <td className="px-4 py-3 text-muted-foreground">
        {agency.cities.length > 0 ? (
          <span className="line-clamp-2 max-w-[16rem]">
            {agency.cities.join(", ")}
          </span>
        ) : (
          "—"
        )}
      </td>

      {/* Branch count */}
      <td className="px-4 py-3 text-right tabular-nums text-foreground">
        {agency.branchCount}
      </td>

      {/* Car count */}
      <td className="px-4 py-3 text-right tabular-nums text-foreground">
        {agency.carCount}
      </td>

      {/* Rating + reviews ("New" when there are no reviews) */}
      <td className="px-4 py-3">
        <StarRating rating={agency.ratingAvg} count={agency.reviewCount} />
      </td>

      {/* Created */}
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {fmtDate(agency.createdAt)}
      </td>

      {/* Public storefront link (opens in a new tab so the admin keeps place) */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <Link
          href={`/agencies/${agency.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Storefront
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </td>
    </tr>
  );
}
