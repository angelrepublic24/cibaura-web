"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePenLine, Plus } from "lucide-react";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  ContractTemplateEditor,
  TemplateStatusBadge,
} from "@/features/admin/components/contract-template-editor";
import { CONTRACT_KIND_LABELS } from "@/features/admin/contracts";
import { useContractTemplates } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import {
  CONTRACT_KINDS,
  type ContractKind,
  type ContractTemplateAdminDto,
} from "@/shared/types/domain";
import { RoleGuard } from "@/shared/auth/guard";
import {
  EmptyState,
  ErrorState,
} from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatDateTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/**
 * /admin/contracts — versioned contract templates (ADR-0010). One tab per
 * kind (host agreement / rental agreement); the list shows every version
 * newest first with its status; selecting one opens the editor (drafts) or
 * the read-only view. "New draft" starts from the published text so an
 * admin edits a copy, never the signed version.
 */

const STARTER_BODY = `# Title

Write the contract in Markdown. Insert variables from the palette, e.g. {{host.legalName}} or {{platform.legalName}}.
`;

const KIND_DESCRIPTIONS: Record<ContractKind, string> = {
  host_agreement:
    "Signed once by every host owner during onboarding; required before a car can go live. Publishing with “require re-sign” asks existing hosts to sign the new version.",
  rental_agreement:
    "Signed by the customer with every booking request and countersigned by the host on acceptance. New versions apply to new requests only.",
};

export default function AdminContractsPage() {
  const [kind, setKind] = useState<ContractKind>("host_agreement");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <RoleGuard allow={["platform_admin"]}>
      <div>
        <div>
          <h1 className="font-display text-2xl text-foreground">Contracts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit the contract templates as Markdown with variables, preview
            them as the server renders them, and publish new versions. Signed
            documents are immutable snapshots of the version they were signed
            under.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Contract kind"
          className="mt-6 inline-flex overflow-hidden rounded-md border border-border"
        >
          {CONTRACT_KINDS.map((k, i) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setSelectedId(null);
              }}
              className={cn(
                "px-4 py-2 text-sm transition-colors",
                i > 0 && "border-l border-border",
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {CONTRACT_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {KIND_DESCRIPTIONS[kind]}
        </p>

        <KindWorkspace
          key={kind}
          kind={kind}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </RoleGuard>
  );
}

function KindWorkspace({
  kind,
  selectedId,
  onSelect,
}: {
  kind: ContractKind;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const qc = useQueryClient();
  const list = useContractTemplates(kind);
  const templates = list.data ?? [];
  const published = templates.find((t) => t.status === "published") ?? null;
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  const createDraft = useMutation({
    mutationFn: () =>
      AdminApi.createContractTemplate({
        kind,
        title: published?.title ?? CONTRACT_KIND_LABELS[kind],
        bodyMarkdown: published?.bodyMarkdown ?? STARTER_BODY,
      }),
    onSuccess: (draft) => {
      qc.invalidateQueries({ queryKey: adminKeys.contractTemplates(kind) });
      onSelect(draft.id);
    },
  });

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,300px)_1fr]">
      <div className="space-y-3">
        <Button
          className="w-full"
          disabled={createDraft.isPending || list.isLoading}
          onClick={() => createDraft.mutate()}
        >
          <Plus className="h-4 w-4" />
          {createDraft.isPending
            ? "Creating…"
            : published
              ? "New draft from published"
              : "New draft"}
        </Button>
        {createDraft.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(createDraft.error, "Could not create the draft.")}
          </p>
        ) : null}

        {list.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState
            title="Could not load templates"
            message={getErrorMessage(list.error, "Please try again.")}
            onRetry={() => list.refetch()}
          />
        ) : templates.length === 0 ? (
          <EmptyState
            title="No versions yet"
            description="Create a draft to write the first version of this contract."
            className="py-10"
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <TemplateListItem
                key={t.id}
                template={t}
                selected={t.id === selectedId}
                onSelect={() => onSelect(t.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <div>
        {selected ? (
          <ContractTemplateEditor key={selected.id} template={selected} kind={kind} />
        ) : (
          <Card>
            <CardContent className="py-16">
              <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <FilePenLine className="h-4 w-4" />
                Select a version to read it, or create a draft to start editing.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TemplateListItem({
  template: t,
  selected,
  onSelect,
}: {
  template: ContractTemplateAdminDto;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected}
        className={cn(
          "w-full rounded-[var(--radius-sm)] border px-3.5 py-3 text-left transition-colors",
          selected
            ? "border-primary bg-accent-soft"
            : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium text-foreground">
            {t.version === null ? "Draft" : `v${t.version}`} · {t.title}
          </span>
          <TemplateStatusBadge status={t.status} />
        </div>
        {t.changeNote ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {t.changeNote}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {t.publishedAt
            ? `Published ${formatDateTime(t.publishedAt)}`
            : `Created ${formatDateTime(t.createdAt)}`}
          {t.requireResign ? " · re-sign required" : ""}
        </p>
      </button>
    </li>
  );
}
