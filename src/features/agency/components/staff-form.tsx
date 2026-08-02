"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  AGENCY_PERMISSIONS,
  BUNDLE_DESCRIPTIONS,
  BUNDLE_LABELS,
  BUNDLE_PERMISSIONS,
  PERMISSION_LABELS,
  type AgencyPermission,
  type AssignableRole,
  type BranchScopeMode,
  type StaffMember,
} from "@/features/agency/rbac";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

const ASSIGNABLE_ROLES: AssignableRole[] = ["manager", "sales", "custom"];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type StaffFormProps =
  | { mode: "create"; onDone: () => void }
  | { mode: "edit"; member: StaffMember; onDone: () => void };

/**
 * Create / edit form for an agency staff member. Controlled state (rather than
 * react-hook-form) keeps the dynamic permission + branch checkbox lists simple.
 *
 * The server is the real authority — it re-validates every field and rejects
 * granting permissions the caller doesn't hold. This form only shapes input and
 * surfaces the exact server error on failure. Password is create-only and is
 * NEVER sent on edit.
 */
export function StaffForm(props: StaffFormProps) {
  const qc = useQueryClient();
  const editing = props.mode === "edit";
  const member = editing ? props.member : undefined;

  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>(member?.role ?? "sales");
  const [permissions, setPermissions] = useState<AgencyPermission[]>(
    member?.permissions ?? [],
  );
  const [branchScopeMode, setBranchScopeMode] = useState<BranchScopeMode>(
    member?.branchScope.mode ?? "all",
  );
  const [branchIds, setBranchIds] = useState<string[]>(
    member?.branchScope.branchIds ?? [],
  );
  const [isActive, setIsActive] = useState<boolean>(member?.isActive ?? true);

  const branchesQuery = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
    enabled: branchScopeMode === "branches",
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (props.mode === "create") {
        return AgencyApi.createStaff({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          permissions: role === "custom" ? permissions : undefined,
          branchScopeMode,
          branchIds: branchScopeMode === "branches" ? branchIds : undefined,
        });
      }
      return AgencyApi.updateStaff(props.member.id, {
        role,
        permissions: role === "custom" ? permissions : undefined,
        branchScopeMode,
        branchIds: branchScopeMode === "branches" ? branchIds : undefined,
        isActive,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.staff() });
      props.onDone();
    },
  });

  function togglePermission(p: AgencyPermission) {
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function toggleBranch(id: string) {
    setBranchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const nameOk = editing || name.trim().length >= 2;
  const emailOk = editing || EMAIL_RE.test(email.trim());
  const passwordOk = editing || password.length >= 8;
  const permsOk = role !== "custom" || permissions.length > 0;
  const scopeOk = branchScopeMode !== "branches" || branchIds.length > 0;
  const ready = nameOk && emailOk && passwordOk && permsOk && scopeOk;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">
          {editing ? `Edit ${member!.name}` : "Add staff member"}
        </CardTitle>
        {editing ? (
          <p className="text-sm text-muted-foreground">{member!.email}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Identity — editable on create only (name/email are immutable on edit). */}
        {editing ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                placeholder="jane@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="staff-password">Temporary password</Label>
              <Input
                id="staff-password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                They sign in with this and can change it later.
              </p>
            </div>
          </div>
        )}

        {/* Role */}
        <div className="space-y-1.5">
          <Label htmlFor="staff-role">Role</Label>
          <Select
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AssignableRole)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {BUNDLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <p className="text-sm text-muted-foreground">
            {BUNDLE_DESCRIPTIONS[role]}
          </p>
        </div>

        {/* Permissions — read-only preview for bundles, checkboxes for custom. */}
        <div className="space-y-2">
          <Label>Permissions</Label>
          {role === "custom" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {AGENCY_PERMISSIONS.map((p) => {
                  const checked = permissions.includes(p);
                  return (
                    <label
                      key={p}
                      className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => togglePermission(p)}
                      />
                      <span className="text-sm text-foreground">
                        {PERMISSION_LABELS[p]}
                      </span>
                    </label>
                  );
                })}
              </div>
              {!permsOk ? (
                <p className="text-sm text-muted-foreground">
                  Select at least one permission.
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-wrap gap-1.5 rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 p-3">
              {BUNDLE_PERMISSIONS[role].map((p) => (
                <Badge key={p} variant="secondary">
                  {PERMISSION_LABELS[p]}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Branch scope */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="staff-scope">Branch access</Label>
            <Select
              id="staff-scope"
              value={branchScopeMode}
              onChange={(e) =>
                setBranchScopeMode(e.target.value as BranchScopeMode)
              }
            >
              <option value="all">All branches</option>
              <option value="branches">Specific branches</option>
            </Select>
          </div>

          {branchScopeMode === "branches" ? (
            branchesQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading branches…</p>
            ) : branchesQuery.isError ? (
              <p className="text-sm text-red-600">
                {branchesQuery.error.message}
              </p>
            ) : (branchesQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No branches yet — add one first, or grant access to all
                branches.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {branchesQuery.data!.map((b) => {
                  const checked = branchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-surface p-3 transition-colors hover:border-border-strong"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        checked={checked}
                        onChange={() => toggleBranch(b.id)}
                      />
                      <span className="text-sm text-foreground">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            )
          ) : null}
          {!scopeOk ? (
            <p className="text-sm text-muted-foreground">
              Select at least one branch.
            </p>
          ) : null}
        </div>

        {/* Active state — edit only. */}
        {editing ? (
          <div className="space-y-1.5">
            <Label htmlFor="staff-active">Status</Label>
            <Select
              id="staff-active"
              value={isActive ? "active" : "inactive"}
              onChange={(e) => setIsActive(e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        ) : null}

        {mutation.isError ? (
          <p className="text-sm text-red-600">{mutation.error.message}</p>
        ) : null}

        <div className="flex gap-2">
          <Button
            disabled={!ready || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Add staff member"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => props.onDone()}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
