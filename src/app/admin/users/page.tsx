"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCircle } from "lucide-react";
import { AdminApi, adminKeys, type AdminUser } from "@/features/admin/api";
import { useAuthStore } from "@/shared/auth/store";
import { RoleGuard } from "@/shared/auth/guard";
import { ReasonDialog } from "@/shared/components/reason-dialog";
import { EmptyState, ErrorState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * /admin/users — every account on the platform: search by email/name, filter
 * by role and status, suspend (revokes every session; login answers
 * USER_SUSPENDED) or reactivate. Platform admins and the caller's own account
 * cannot be suspended — the backend answers 400; the row hides the button.
 */

const PAGE_SIZE = 20;

const ROLE_FILTERS = [
  { value: "", label: "All roles" },
  { value: "customer", label: "Customer" },
  { value: "agency_owner", label: "Agency owner" },
  { value: "agency_staff", label: "Agency staff" },
  { value: "platform_admin", label: "Platform admin" },
];

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];

const ROLE_LABELS: Record<string, string> = {
  customer: "Customer",
  agency_owner: "Agency owner",
  agency_staff: "Agency staff",
  platform_admin: "Platform admin",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function UserStatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "suspended")
    return <Badge variant="destructive">Suspended</Badge>;
  if (status === "deleted") return <Badge variant="secondary">Deleted</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const query = { q, role, status, page, pageSize: PAGE_SIZE };
  const listQuery = useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => AdminApi.listUsers(query),
    placeholderData: keepPreviousData,
  });

  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every account on the platform. Suspending signs the person out
            everywhere and blocks new logins until reactivated.
          </p>
        </div>

        {/* Filters */}
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
            setPage(1);
          }}
        >
          <div className="w-72 space-y-1.5">
            <Label htmlFor="user-search" className="text-xs">
              Search
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="user-search"
                className="pl-9"
                placeholder="Email or name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="user-role" className="text-xs">
              Role
            </Label>
            <Select
              id="user-role"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              {ROLE_FILTERS.map((r) => (
                <option key={r.value || "all"} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="user-status" className="text-xs">
              Status
            </Label>
            <Select
              id="user-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value || "all"} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="mt-6">
          {listQuery.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : listQuery.isError ? (
            <ErrorState
              title="Could not load users"
              message={listQuery.error.message}
              onRetry={() => listQuery.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No users match"
              description="Try a different search or clear the filters."
              className="py-12"
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                {total} user{total === 1 ? "" : "s"}
              </p>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table
                    className={cn(
                      "w-full min-w-[760px] border-collapse text-sm",
                      listQuery.isFetching && "opacity-60 transition-opacity",
                    )}
                  >
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Roles</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((u) => (
                        <UserRow key={u.id} user={u} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {pageCount > 1 ? (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || listQuery.isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pageCount || listQuery.isFetching}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function UserRow({ user: u }: { user: AdminUser }) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [action, setAction] = useState<null | "suspend" | "reactivate">(null);

  const isSelf = me?.id === u.id;
  const isAdmin = u.roles.includes("platform_admin");
  const canSuspend = u.status === "active" && !isSelf && !isAdmin;
  const canReactivate = u.status === "suspended";

  function invalidate() {
    qc.invalidateQueries({ queryKey: adminKeys.users() });
  }

  return (
    <tr className="align-middle transition-colors hover:bg-muted/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {u.name}
              {isSelf ? (
                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
              ) : null}
              {u.isGuest ? (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  · guest
                </span>
              ) : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {u.email}
              {u.phone ? ` · ${u.phone}` : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant="secondary">
              {ROLE_LABELS[r] ?? r}
            </Badge>
          ))}
        </div>
      </td>
      <td className="px-4 py-3">
        <UserStatusBadge status={u.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {fmtDate(u.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {canSuspend ? (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setAction("suspend")}
          >
            Suspend
          </Button>
        ) : canReactivate ? (
          <Button size="sm" variant="outline" onClick={() => setAction("reactivate")}>
            Reactivate
          </Button>
        ) : null}

        <ReasonDialog
          open={action === "suspend"}
          onClose={() => setAction(null)}
          title={`Suspend ${u.name}?`}
          description="They are signed out everywhere immediately and cannot sign in again until reactivated. Their bookings are not changed."
          field={{
            label: "Reason",
            placeholder: "Internal note, e.g. chargeback fraud under review",
            hint: "Kept for the audit trail.",
            minLength: 2,
            maxLength: 300,
            optional: true,
          }}
          confirmLabel="Suspend account"
          destructive
          onConfirm={async (value) => {
            await AdminApi.setUserStatus(u.id, "suspended", value);
            invalidate();
          }}
        />
        <ReasonDialog
          open={action === "reactivate"}
          onClose={() => setAction(null)}
          title={`Reactivate ${u.name}?`}
          description="They can sign in again right away."
          field={{
            label: "Note",
            placeholder: "e.g. Dispute resolved",
            minLength: 2,
            maxLength: 300,
            optional: true,
          }}
          confirmLabel="Reactivate account"
          onConfirm={async (value) => {
            await AdminApi.setUserStatus(u.id, "active", value);
            invalidate();
          }}
        />
      </td>
    </tr>
  );
}
