"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock } from "lucide-react";
import {
  InvitesApi,
  inviteKeys,
  INVITE_ROLES,
  type AdminInvite,
  type InviteRole,
} from "@/features/admin/invites";
import { RoleGuard } from "@/shared/auth/guard";
import {
  EmptyState,
  ErrorState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";

/**
 * /admin/roots — manage the platform super-admins ("roots").
 *
 * A root invites another root by email; the invitee gets a link and sets
 * their own password to activate a platform_admin account. This page (1)
 * sends invites (POST /admin/invites) and (2) lists still-pending, non-expired
 * invites with a Revoke affordance (DELETE /admin/invites/:id). The raw token
 * only ever lives in the outgoing email — it never reaches this UI. The /admin
 * layout already gates platform_admin; we wrap again defensively.
 */

/** Loose client-side email check — the backend DTO is the real gate. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ISO datetime → "Aug 1, 2026". */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Whole days from now until `iso` (>= 0). */
function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function AdminRootsPage() {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>(INVITE_ROLES[0].value);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: inviteKeys.list(),
    queryFn: InvitesApi.list,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: inviteKeys.all });

  const invite = useMutation({
    mutationFn: () =>
      InvitesApi.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        role,
      }),
    onSuccess: (created) => {
      setSentTo(created.email);
      setFirstName("");
      setLastName("");
      setEmail("");
      invalidate();
    },
  });

  const trimmed = email.trim();
  const canSubmit =
    EMAIL_RE.test(trimmed) && !!firstName.trim() && !!lastName.trim();
  const invites = listQuery.data ?? [];

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">
            Platform admins
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite another root by email. They open the link and set their own
            password to activate a platform-admin account — you never see or
            handle their password.
          </p>
        </div>

        {/* ── Invite form ─────────────────────────────────────────────── */}
        <Card className="mt-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-foreground">
              Invite a new admin
            </h2>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit && !invite.isPending) {
                  invite.reset();
                  setSentTo(null);
                  invite.mutate();
                }
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-first" className="text-xs">
                    First name
                  </Label>
                  <Input
                    id="invite-first"
                    autoComplete="off"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (sentTo) setSentTo(null);
                      if (invite.isError) invite.reset();
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-last" className="text-xs">
                    Last name
                  </Label>
                  <Input
                    id="invite-last"
                    autoComplete="off"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (sentTo) setSentTo(null);
                      if (invite.isError) invite.reset();
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="text-xs">
                    Email address
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    autoComplete="off"
                    placeholder="new.admin@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (sentTo) setSentTo(null);
                      if (invite.isError) invite.reset();
                    }}
                    aria-invalid={trimmed.length > 0 && !EMAIL_RE.test(trimmed)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role" className="text-xs">
                    Role
                  </Label>
                  <Select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as InviteRole)}
                  >
                    {INVITE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!canSubmit || invite.isPending}
              >
                {invite.isPending ? "Sending…" : "Send invite"}
              </Button>
            </form>

            {invite.isError ? (
              <p className="mt-2 text-sm text-destructive">
                {(invite.error as Error).message}
              </p>
            ) : null}
            {sentTo ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Invitation sent to{" "}
                  <span className="font-medium">{sentTo}</span>. It expires in 7
                  days.
                </span>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* ── Pending invites ─────────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">
            Pending invites
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Invitations that haven&apos;t been accepted yet and haven&apos;t
            expired. Revoke one to stop the link from working.
          </p>

          <div className="mt-3">
            {listQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : listQuery.isError ? (
              <ErrorState
                title="Could not load invites"
                message={(listQuery.error as Error).message}
                onRetry={() => listQuery.refetch()}
              />
            ) : invites.length === 0 ? (
              <EmptyState
                title="No pending invites"
                description="Every invitation has been accepted or revoked. Send a new one above."
                className="py-12"
              />
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface">
                {invites.map((inv) => (
                  <InviteRow key={inv.id} invite={inv} onDone={invalidate} />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}

function InviteRow({
  invite,
  onDone,
}: {
  invite: AdminInvite;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const revoke = useMutation({
    mutationFn: () => InvitesApi.revoke(invite.id),
    onSuccess: () => {
      setConfirming(false);
      onDone();
    },
  });

  const days = daysUntil(invite.expiresAt);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">
          {`${invite.firstName} ${invite.lastName}`.trim() || invite.email}
        </p>
        <p className="truncate text-xs text-muted-foreground">{invite.email}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Expires {fmtDate(invite.expiresAt)}
          </span>
          <Badge variant={days <= 1 ? "warning" : "secondary"}>
            {days === 0
              ? "Expires today"
              : days === 1
                ? "1 day left"
                : `${days} days left`}
          </Badge>
          {invite.invitedByName ? (
            <span>Invited by {invite.invitedByName}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              {revoke.isPending ? "Revoking…" : "Confirm revoke"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={revoke.isPending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              revoke.reset();
              setConfirming(true);
            }}
          >
            Revoke
          </Button>
        )}
      </div>

      {revoke.isError ? (
        <p className="w-full text-sm text-destructive">
          {(revoke.error as Error).message}
        </p>
      ) : null}
    </li>
  );
}
