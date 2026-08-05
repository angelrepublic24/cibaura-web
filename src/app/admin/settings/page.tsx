"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminApi, adminKeys } from "@/features/admin/api";
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
 * /admin/settings — platform settings. Today this hosts the single
 * "Commission" section (moved out of the old /admin index, which is now the
 * Overview screen); future platform-wide settings sections slot in below it.
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
