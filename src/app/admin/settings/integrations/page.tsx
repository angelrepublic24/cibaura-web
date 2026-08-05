"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";
import {
  IntegrationsApi,
  integrationKeys,
  type IntegrationsView,
  type SettingView,
} from "@/features/admin/integrations";
import { RoleGuard } from "@/shared/auth/guard";
import { ErrorState, LoadingState } from "@/shared/components/states";
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

/**
 * /admin/settings/integrations — platform-admin managed, encrypted
 * third-party integration secrets (SendGrid, Stripe). Lets a root change keys
 * from the UI instead of editing .env; the resolved value chain everywhere is
 * DB (decrypted) ?? process.env fallback.
 *
 * SECURITY: the server never returns plaintext secrets — every field here only
 * shows a masked `preview` (last 4 chars for secrets, full value for
 * non-secrets). Writing a SECRET requires CONFIG_ENCRYPTION_KEY on the server;
 * when it's missing we disable secret saves and explain why. The /admin layout
 * already gates platform_admin; we wrap defensively.
 */

/** ISO datetime → "Aug 1, 2026, 3:04 PM". */
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SourceChip({ source }: { source: SettingView["source"] }) {
  if (source === "db") return <Badge variant="success">Configured</Badge>;
  if (source === "env") return <Badge variant="secondary">Env default</Badge>;
  return <Badge variant="outline">Not set</Badge>;
}

export default function AdminIntegrationsPage() {
  const query = useQuery({
    queryKey: integrationKeys.list(),
    queryFn: IntegrationsApi.list,
  });

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure third-party API keys without editing the server&apos;s{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code>.
            Secrets are encrypted at rest — once saved, only the last few
            characters are ever shown. A stored value overrides the environment
            default; clear it to fall back to the environment.
          </p>
        </div>

        <div className="mt-6">
          {query.isLoading ? (
            <LoadingState label="Loading integrations…" />
          ) : query.isError ? (
            <ErrorState
              title="Could not load integrations"
              message={(query.error as Error).message}
              onRetry={() => query.refetch()}
            />
          ) : (
            <IntegrationsContent data={query.data!} />
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

function IntegrationsContent({ data }: { data: IntegrationsView }) {
  return (
    <div className="space-y-6">
      {!data.masterKeyConfigured ? (
        <div
          className="flex items-start gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning-soft px-4 py-3"
          role="alert"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              Encryption key not configured
            </p>
            <p className="mt-0.5 text-muted-foreground">
              Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                CONFIG_ENCRYPTION_KEY
              </code>{" "}
              on the server before saving any secret. Until then, secret fields
              below are read-only (they still resolve from the environment).
              Non-secret fields can still be edited.
            </p>
          </div>
        </div>
      ) : null}

      {data.groups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No integrations are available.
          </CardContent>
        </Card>
      ) : (
        data.groups.map((group) => (
          <Card key={group.group}>
            <CardHeader>
              <CardTitle>{group.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {group.items.map((item) => (
                  <SettingRow
                    key={item.key}
                    item={item}
                    masterKeyConfigured={data.masterKeyConfigured}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function SettingRow({
  item,
  masterKeyConfigured,
}: {
  item: SettingView;
  masterKeyConfigured: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: integrationKeys.all });

  const save = useMutation({
    mutationFn: () => IntegrationsApi.set(item.key, value),
    onSuccess: () => {
      setValue("");
      setEditing(false);
      setSaved(true);
      invalidate();
    },
  });

  const clear = useMutation({
    mutationFn: () => IntegrationsApi.clear(item.key),
    onSuccess: () => {
      setSaved(false);
      invalidate();
    },
  });

  // Saving a secret requires the server-side master key; non-secrets never do.
  const writeBlocked = item.secret && !masterKeyConfigured;
  const canSave = value.trim() !== "" && !writeBlocked && !save.isPending;
  const busy = save.isPending || clear.isPending;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{item.label}</span>
            <SourceChip source={item.source} />
            {item.secret ? (
              <Badge variant="accent">
                <KeyRound className="h-3 w-3" />
                Secret
              </Badge>
            ) : null}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            {item.configured ? (
              <span className="font-mono text-foreground">
                {item.preview ?? "—"}
              </span>
            ) : (
              <span>Not configured.</span>
            )}
            {item.source === "db" && item.updatedAt ? (
              <span className="ml-2">
                Updated {fmtDateTime(item.updatedAt)}
              </span>
            ) : null}
            {item.source === "env" ? (
              <span className="ml-2">Resolved from environment default.</span>
            ) : null}
            {item.source === "unset" && !item.envAvailable ? (
              <span className="ml-2">No environment fallback available.</span>
            ) : null}
          </div>
        </div>

        {!editing ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={writeBlocked}
              onClick={() => {
                save.reset();
                setSaved(false);
                setEditing(true);
              }}
            >
              {item.source === "db" ? "Replace" : "Set value"}
            </Button>
            {item.source === "db" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  clear.reset();
                  clear.mutate();
                }}
              >
                {clear.isPending ? "Clearing…" : "Use environment default"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <Label htmlFor={`set-${item.key}`} className="text-xs">
            New value
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={`set-${item.key}`}
              type={item.secret ? "password" : "text"}
              autoComplete="off"
              spellCheck={false}
              className="max-w-md flex-1"
              placeholder={
                item.secret ? "Paste the new secret" : "Enter a value"
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={writeBlocked || save.isPending}
            />
            <Button type="submit" size="sm" disabled={!canSave}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                setValue("");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
          {writeBlocked ? (
            <p className="text-xs text-warning">
              Set CONFIG_ENCRYPTION_KEY on the server to save this secret.
            </p>
          ) : item.secret ? (
            <p className="text-xs text-muted-foreground">
              The value is sent once and stored encrypted; it can never be read
              back — only replaced.
            </p>
          ) : null}
        </form>
      ) : null}

      {save.isError ? (
        <p className="mt-2 text-sm text-destructive">
          {(save.error as Error).message}
        </p>
      ) : null}
      {clear.isError ? (
        <p className="mt-2 text-sm text-destructive">
          {(clear.error as Error).message}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Saved.
        </p>
      ) : null}
    </li>
  );
}
