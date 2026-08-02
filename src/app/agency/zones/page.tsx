"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { formatMoneyCents, wholeUnitsToCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /agency/zones — delivery zones per branch (airport, hotel zone…), each with a
 * fixed extra fee snapshotted into a booking's pricing when a customer picks
 * delivery. Pick a branch, then create/delete its zones.
 */
export default function AgencyZonesPage() {
  const [branchId, setBranchId] = useState("");

  const branchesQuery = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Delivery zones</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Named drop-off locations with a fixed extra fee. The fee is frozen into
        the booking when a customer chooses delivery.
      </p>

      <div className="mt-4 max-w-sm space-y-1.5">
        <Label htmlFor="z-branch">Branch</Label>
        <Select
          id="z-branch"
          value={branchId}
          disabled={branchesQuery.isLoading || branchesQuery.isError}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">
            {branchesQuery.isError
              ? "Branches unavailable"
              : "Select a branch"}
          </option>
          {(branchesQuery.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.city ? ` — ${b.city.name}` : ""}
            </option>
          ))}
        </Select>
      </div>

      {branchesQuery.isSuccess && branchesQuery.data.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No branches yet"
          description="Create a branch first — delivery zones belong to a branch."
        />
      ) : branchId ? (
        <ZonesForBranch branchId={branchId} />
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Select a branch to manage its delivery zones.
        </p>
      )}
    </div>
  );
}

function ZonesForBranch({ branchId }: { branchId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [fee, setFee] = useState("");

  const zonesQuery = useQuery({
    queryKey: agencyKeys.zones(branchId),
    queryFn: () => AgencyApi.zones(branchId),
  });

  const create = useMutation({
    mutationFn: () =>
      AgencyApi.createZone(branchId, {
        name: name.trim(),
        // Unit conversion at the input boundary (agency-entered fee).
        feeCents: wholeUnitsToCents(Number(fee)),
      }),
    onSuccess: () => {
      setName("");
      setFee("");
      qc.invalidateQueries({ queryKey: agencyKeys.zones(branchId) });
    },
  });

  const remove = useMutation({
    mutationFn: (zoneId: string) => AgencyApi.deleteZone(zoneId),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.zones(branchId) }),
  });

  const feeValid = /^\d+(\.\d{1,2})?$/.test(fee);
  const ready = name.trim().length >= 2 && feeValid;

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="z-name">Zone name</Label>
              <Input
                id="z-name"
                placeholder="Cibao Airport"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="z-fee">Fee</Label>
              <Input
                id="z-fee"
                inputMode="decimal"
                placeholder="20.00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <Button
              disabled={!ready || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Adding…" : "Add zone"}
            </Button>
          </div>
          {create.isError ? (
            <p className="mt-3 text-sm text-red-600">{create.error.message}</p>
          ) : null}
        </CardContent>
      </Card>

      {zonesQuery.isLoading ? (
        <LoadingState label="Loading zones…" />
      ) : zonesQuery.isError ? (
        <ErrorState
          title="Could not load zones"
          message={zonesQuery.error.message}
          onRetry={() => zonesQuery.refetch()}
        />
      ) : (zonesQuery.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No delivery zones"
          description="Add a zone above to offer delivery for this branch."
        />
      ) : (
        <div className="space-y-2">
          {zonesQuery.data!.map((z) => (
            <div
              key={z.id}
              className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
            >
              <span>
                <span className="font-medium">{z.name}</span>{" "}
                <span className="text-muted-foreground">
                  +{formatMoneyCents(z.feeCents)}
                </span>
                {!z.isActive ? (
                  <span className="text-muted-foreground"> · inactive</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete zone"
                disabled={remove.isPending}
                onClick={() => remove.mutate(z.id)}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
