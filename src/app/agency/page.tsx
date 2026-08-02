"use client";

import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { formatMoneyCents } from "@/shared/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

/** /agency — dashboard home: headline stats from real queries. */
export default function AgencyDashboardPage() {
  const fleetQuery = useQuery({
    queryKey: agencyKeys.fleet(),
    queryFn: () => AgencyApi.fleet(),
  });
  const requestsQuery = useQuery({
    queryKey: agencyKeys.requests({ state: "requested" }),
    queryFn: () => AgencyApi.requests({ state: "requested" }),
  });
  const walletQuery = useQuery({
    queryKey: agencyKeys.wallet(),
    queryFn: AgencyApi.wallet,
  });

  const stats = [
    {
      label: "Cars in fleet",
      value: fleetQuery.data ? String(fleetQuery.data.total) : undefined,
      loading: fleetQuery.isLoading,
      error: fleetQuery.isError,
    },
    {
      label: "Pending requests",
      value: requestsQuery.data ? String(requestsQuery.data.total) : undefined,
      loading: requestsQuery.isLoading,
      error: requestsQuery.isError,
    },
    {
      label: "Wallet balance",
      value: walletQuery.data
        ? formatMoneyCents(
            walletQuery.data.account.balanceCents,
            walletQuery.data.account.currency,
          )
        : undefined,
      loading: walletQuery.isLoading,
      error: walletQuery.isError,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl text-foreground">
        Agency dashboard
      </h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {s.loading ? (
                <Skeleton className="h-8 w-20" />
              ) : s.error ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {s.value}
                </span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Utilization charts and recent activity land with the reporting
        iteration.
      </p>
    </div>
  );
}
