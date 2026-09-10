"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
import { useLegalCurrent } from "@/features/legal/hooks";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

/**
 * /admin/settings — platform settings: the editable commission plus the
 * cancellation policy the backend currently publishes (read-only here — the
 * numbers come from `GET /legal/current` and are set in backend config, so
 * this card exists to make what customers are promised visible to admins).
 */
export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Platform-wide configuration.
        </p>
      </div>

      <CommissionSettings />
      <CancellationPolicyCard />
    </div>
  );
}

/**
 * Read-only view of the tiered cancellation policy — the same numbers the
 * legal pages, booking flows and refund logic key off. No edit path: the
 * platform config endpoint carries only the commission today.
 */
function CancellationPolicyCard() {
  const legal = useLegalCurrent();

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Cancellation policy</CardTitle>
        <CardDescription>
          Published under terms version{" "}
          {legal.data?.termsVersion ?? "…"}. Configured on the backend; shown
          here so support and finance read the same numbers customers see.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {legal.isLoading ? (
          <LoadingState label="Loading policy…" className="py-4" />
        ) : legal.isError ? (
          <ErrorState
            title="Could not load the policy"
            message={legal.error.message}
            onRetry={() => legal.refetch()}
            className="py-6"
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <PolicyStat
              label="Free cancellation"
              value={`${legal.data!.cancellationPolicy.freeCancellationHours} h`}
              hint="before pickup"
            />
            <PolicyStat
              label="Late cancellation"
              value={`${legal.data!.cancellationPolicy.lateCancellationRetentionPct}%`}
              hint="retained by the agency"
            />
            <PolicyStat
              label="Early return penalty"
              value={`${legal.data!.cancellationPolicy.earlyReturnPenaltyDays} day${
                legal.data!.cancellationPolicy.earlyReturnPenaltyDays === 1 ? "" : "s"
              }`}
              hint="not refunded"
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function PolicyStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      <dd className="text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

/**
 * Commission section. The value is SNAPSHOTTED into each booking's pricing at
 * request time, so changing it only affects future requests; it never
 * rewrites existing bookings (docs/DOMAIN.md, invariant #2).
 */
function CommissionSettings() {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const query = useQuery({
    queryKey: adminKeys.config(),
    queryFn: AdminApi.getConfig,
  });

  // Seed the input from the server once the config loads.
  useEffect(() => {
    if (query.data) setValue(String(query.data.commissionPct));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () => AdminApi.setCommission(Number(value)),
    onSuccess: (config) => {
      qc.setQueryData(adminKeys.config(), config);
      setSaved(true);
    },
  });

  if (query.isLoading) return <LoadingState label="Loading configuration…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load configuration"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= 100;
  const dirty = value !== String(query.data?.commissionPct ?? "");

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Commission percentage</CardTitle>
        <CardDescription>
          Applied to each booking&apos;s subtotal and frozen into its pricing
          snapshot at request time. Editing it never changes existing bookings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="commission">Commission %</Label>
            <div className="flex items-center gap-2">
              <Input
                id="commission"
                inputMode="decimal"
                className="max-w-[140px]"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setSaved(false);
                }}
              />
              <span className="text-muted-foreground">%</span>
            </div>
            {value.trim() !== "" && !valid ? (
              <p className="text-sm text-red-600">
                Enter a number between 0 and 100.
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm text-red-600">{mutation.error.message}</p>
          ) : null}
          {saved && !dirty ? (
            <p className="text-sm text-emerald-700">Commission updated.</p>
          ) : null}

          <Button type="submit" disabled={!valid || !dirty || mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save commission"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
