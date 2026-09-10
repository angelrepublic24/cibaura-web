"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Truck } from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  BranchForm,
  WEEK_DAYS,
  WEEK_DAY_LABELS,
} from "@/features/agency/components/branch-form";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import type { Branch } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

/**
 * /agency/branches — the agency's branches (`branches:manage`). Cars belong
 * to a branch and search results come from branches in the searched city, so
 * this is the first thing an agency sets up. Create, edit (address, phone,
 * opening hours, delivery config) and activate/pause.
 */
export default function AgencyBranchesPage() {
  return (
    <PermissionGate permission="branches:manage">
      <BranchesBody />
    </PermissionGate>
  );
}

function BranchesBody() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Branches</h1>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Close" : "Add branch"}
        </Button>
      </div>

      {showForm ? (
        <BranchForm mode="create" onDone={() => setShowForm(false)} />
      ) : null}

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading branches…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load branches"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No branches yet"
            description="Add a branch so your cars have a pickup location and show up in city search."
            action={<Button onClick={() => setShowForm(true)}>Add branch</Button>}
          />
        ) : (
          <div className="space-y-3">
            {query.data!.map((b) =>
              editingId === b.id ? (
                <BranchForm
                  key={b.id}
                  mode="edit"
                  branch={b}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <BranchRow
                  key={b.id}
                  branch={b}
                  onEdit={() => {
                    setShowForm(false);
                    setEditingId(b.id);
                  }}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** "Mon–Fri 08:00-18:00 · Sat 09:00-13:00" style summary of the hours map. */
function hoursSummary(hours: Record<string, string> | null): string | null {
  if (!hours) return null;
  const parts = WEEK_DAYS.filter((d) => hours[d]).map(
    (d) => `${WEEK_DAY_LABELS[d].slice(0, 3)} ${hours[d]}`,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

function BranchRow({
  branch,
  onEdit,
}: {
  branch: Branch;
  onEdit: () => void;
}) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () =>
      AgencyApi.updateBranch(branch.id, { isActive: !branch.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.branches() }),
  });

  const hours = hoursSummary(branch.hours);

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{branch.name}</p>
            <Badge variant={branch.isActive ? "success" : "secondary"}>
              {branch.isActive ? "Active" : "Paused"}
            </Badge>
            {branch.deliveryEnabled ? (
              <Badge variant="accent">
                <Truck className="h-3 w-3" />
                Delivery · {formatMoneyCents(branch.deliveryBaseFeeCents)} +{" "}
                {formatMoneyCents(branch.deliveryPerKmCents)}/km
                {branch.deliveryMaxKm ? ` · up to ${branch.deliveryMaxKm} km` : ""}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {branch.address}
            {branch.city ? ` · ${branch.city.name}` : ""}
            {branch.phone ? ` · ${branch.phone}` : ""}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {hours ?? "No opening hours set"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate()}
          >
            {toggle.isPending
              ? "Saving…"
              : branch.isActive
                ? "Pause"
                : "Activate"}
          </Button>
        </div>
        {toggle.isError ? (
          <p className="w-full text-sm text-destructive">{toggle.error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
