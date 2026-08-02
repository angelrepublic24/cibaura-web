"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import {
  BUNDLE_LABELS,
  type BranchScope,
  type StaffMember,
} from "@/features/agency/rbac";
import { StaffForm } from "@/features/agency/components/staff-form";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

/** Human label for a member's branch scope. */
function scopeLabel(scope: BranchScope): string {
  if (scope.mode === "all") return "All branches";
  const n = scope.branchIds.length;
  return `${n} ${n === 1 ? "branch" : "branches"}`;
}

/**
 * /agency/staff — invite teammates and control what each can do (RBAC).
 * Gated on `staff:manage`: the nav already hides the link, but direct
 * navigation must not render the UI either — the guard below enforces that.
 * The server re-checks every mutation regardless.
 */
export default function AgencyStaffPage() {
  const { can, isLoading: permLoading } = usePermission();

  if (permLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!can("staff:manage")) {
    return (
      <EmptyState
        title="No access"
        description="You don't have permission to manage staff. Ask an owner or a manager with staff access."
      />
    );
  }

  return <StaffManager />;
}

function StaffManager() {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: agencyKeys.staff(),
    queryFn: AgencyApi.staff,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Staff</h1>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowCreate((v) => !v);
          }}
        >
          {showCreate ? "Close" : "Add staff member"}
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Invite teammates and choose exactly what each of them can do.
      </p>

      {showCreate ? (
        <div className="mt-6">
          <StaffForm mode="create" onDone={() => setShowCreate(false)} />
        </div>
      ) : null}

      <div className="mt-6">
        {query.isLoading ? (
          <LoadingState label="Loading staff…" />
        ) : query.isError ? (
          <ErrorState
            title="Could not load staff"
            message={query.error.message}
            onRetry={() => query.refetch()}
          />
        ) : (query.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No staff yet"
            description="Add your first teammate to share the workload — you control what they can see and do."
            action={
              <Button onClick={() => setShowCreate(true)}>
                Add staff member
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {query.data!.map((member) =>
              editingId === member.id ? (
                <StaffForm
                  key={member.id}
                  mode="edit"
                  member={member}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <StaffRow
                  key={member.id}
                  member={member}
                  onEdit={() => {
                    setShowCreate(false);
                    setEditingId(member.id);
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

function StaffRow({
  member,
  onEdit,
}: {
  member: StaffMember;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    mutationFn: () => AgencyApi.removeStaff(member.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.staff() });
      setConfirming(false);
    },
  });

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{member.name}</p>
            <Badge variant="accent">{BUNDLE_LABELS[member.role]}</Badge>
            <Badge variant={member.isActive ? "success" : "secondary"}>
              {member.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {member.email} · {scopeLabel(member.branchScope)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-sm text-muted-foreground">
                Deactivate {member.name}?
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? "Deactivating…" : "Confirm"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
              {member.isActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(true)}
                >
                  Deactivate
                </Button>
              ) : null}
            </>
          )}
        </div>

        {remove.isError ? (
          <p className="w-full text-sm text-red-600">{remove.error.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
