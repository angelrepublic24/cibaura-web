"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Braces, Eye, Save, Upload } from "lucide-react";
import {
  AdminApi,
  adminKeys,
  type UpdateContractTemplateInput,
} from "@/features/admin/api";
import {
  contractVariableGroups,
  extractTemplateVariables,
  TEMPLATE_BODY_MAX,
  TEMPLATE_CHANGE_NOTE_MAX,
  TEMPLATE_TITLE_MAX,
  TEMPLATE_TITLE_MIN,
  unknownTemplateVariables,
  variableToken,
} from "@/features/admin/contracts";
import { useContractPreview } from "@/features/admin/hooks";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type {
  ContractKind,
  ContractTemplateAdminDto,
} from "@/shared/types/domain";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatDateTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/** Readable styling for the server-rendered contract HTML (same as the signer). */
const CONTRACT_HTML_CLASS =
  "max-h-[36rem] overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-muted/40 p-5 text-sm leading-relaxed text-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left";

const templateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(TEMPLATE_TITLE_MIN, "Give the template a title")
    .max(TEMPLATE_TITLE_MAX, `At most ${TEMPLATE_TITLE_MAX} characters`),
  changeNote: z
    .string()
    .trim()
    .max(TEMPLATE_CHANGE_NOTE_MAX, `At most ${TEMPLATE_CHANGE_NOTE_MAX} characters`),
  bodyMarkdown: z
    .string()
    .min(1, "The contract body cannot be empty")
    .max(TEMPLATE_BODY_MAX, `At most ${TEMPLATE_BODY_MAX} characters`),
});
type TemplateFormValues = z.infer<typeof templateSchema>;

function templateDefaults(t: ContractTemplateAdminDto): TemplateFormValues {
  return {
    title: t.title,
    changeNote: t.changeNote ?? "",
    bodyMarkdown: t.bodyMarkdown,
  };
}

/** Copy for the publish-time backend codes (spec §0.2). */
function describePublishError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.TEMPLATE_UNKNOWN_VARIABLE:
      return getErrorMessage(
        error,
        "The body uses a variable the renderer does not know. Fix it and publish again.",
      );
    case API_ERROR_CODES.TEMPLATE_NOT_DRAFT:
      return "Only drafts can be published — this version is already published or archived.";
    default:
      return getErrorMessage(error, "Could not publish this template.");
  }
}

function describeSaveError(error: unknown): string {
  return getApiErrorCode(error) === API_ERROR_CODES.TEMPLATE_NOT_DRAFT
    ? "This version is no longer a draft and cannot be edited. Create a new draft instead."
    : getErrorMessage(error, "Could not save the draft.");
}

/**
 * Editor for ONE contract template version (ADR-0010). Drafts are editable
 * (title, change note, Markdown body with a variable palette) and can be
 * published; published/archived versions are read-only. The preview is
 * SERVER-rendered from the last saved body with sample variables
 * (`GET /admin/contract-templates/:id/preview`) — the renderer, sanitizer
 * and money formatting live on the backend, so the client never fakes it.
 */
export function ContractTemplateEditor({
  template,
  kind,
}: {
  template: ContractTemplateAdminDto;
  kind: ContractKind;
}) {
  const qc = useQueryClient();
  const isDraft = template.status === "draft";
  const [publishOpen, setPublishOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Mounted per template id by the page (`key`), so the defaults seed once;
  // a list refetch must never wipe unsaved edits — only a save re-seeds.
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: templateDefaults(template),
  });
  const { reset } = form;

  const save = useMutation({
    mutationFn: (input: UpdateContractTemplateInput) =>
      AdminApi.updateContractTemplate(template.id, input),
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: adminKeys.contractTemplates(kind) });
      qc.invalidateQueries({ queryKey: adminKeys.contractPreview(next.id) });
      reset(templateDefaults(next));
      setSavedAt(Date.now());
    },
  });

  const body = form.watch("bodyMarkdown");
  const usedVariables = extractTemplateVariables(body);
  const unknownVariables = unknownTemplateVariables(body, kind);
  const dirty = form.formState.isDirty;
  const errors = form.formState.errors;

  // Insert `{{var}}` at the caret of the body textarea (or append).
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const { ref: bodyRegisterRef, ...bodyField } = form.register("bodyMarkdown");
  const bodyProps = {
    ...bodyField,
    ref: (el: HTMLTextAreaElement | null) => {
      bodyRegisterRef(el);
      bodyRef.current = el;
    },
  };
  function insertVariable(name: string) {
    const token = variableToken(name);
    const current = form.getValues("bodyMarkdown");
    const el = bodyRef.current;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const next = current.slice(0, start) + token + current.slice(end);
    form.setValue("bodyMarkdown", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (el) {
      requestAnimationFrame(() => {
        el.focus();
        const caret = start + token.length;
        el.setSelectionRange(caret, caret);
      });
    }
  }

  const titleId = useId();
  const noteId = useId();
  const bodyId = useId();

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={form.handleSubmit((values) =>
          save.mutate({
            title: values.title,
            bodyMarkdown: values.bodyMarkdown,
            changeNote: values.changeNote || undefined,
          }),
        )}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                {template.version === null
                  ? "Draft"
                  : `Version ${template.version}`}
              </CardTitle>
              <TemplateStatusBadge status={template.status} />
            </div>
            <CardDescription>
              {isDraft
                ? "Edit the Markdown body, insert variables from the palette, save, then publish. Publishing assigns the next version number and archives the current published one."
                : template.status === "published"
                  ? `Published ${formatDateTime(template.publishedAt)}. Published versions are immutable — create a new draft to change the text.`
                  : `Archived. Signed documents keep the exact text of the version they were signed under.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={titleId}>Title</Label>
                <Input
                  id={titleId}
                  maxLength={TEMPLATE_TITLE_MAX}
                  readOnly={!isDraft}
                  aria-invalid={!!errors.title}
                  {...form.register("title")}
                />
                {errors.title ? (
                  <p className="text-sm text-destructive">{errors.title.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={noteId}>Change note (optional)</Label>
                <Input
                  id={noteId}
                  maxLength={TEMPLATE_CHANGE_NOTE_MAX}
                  placeholder="What changed in this version"
                  readOnly={!isDraft}
                  aria-invalid={!!errors.changeNote}
                  {...form.register("changeNote")}
                />
                {errors.changeNote ? (
                  <p className="text-sm text-destructive">
                    {errors.changeNote.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="space-y-1.5">
                <Label htmlFor={bodyId}>Body (Markdown)</Label>
                <Textarea
                  id={bodyId}
                  className="min-h-[28rem] font-mono text-xs leading-relaxed"
                  spellCheck={false}
                  readOnly={!isDraft}
                  aria-invalid={!!errors.bodyMarkdown}
                  {...bodyProps}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {body.length.toLocaleString("en-US")} /{" "}
                    {TEMPLATE_BODY_MAX.toLocaleString("en-US")} characters ·
                    headings, lists, bold/italic and simple tables are
                    rendered; raw HTML is dropped.
                  </span>
                </div>
                {errors.bodyMarkdown ? (
                  <p className="text-sm text-destructive">
                    {errors.bodyMarkdown.message}
                  </p>
                ) : null}
              </div>

              <VariablePalette
                kind={kind}
                used={usedVariables}
                unknown={unknownVariables}
                disabled={!isDraft}
                onInsert={insertVariable}
              />
            </div>

            {unknownVariables.length > 0 ? (
              <p
                className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800"
                role="alert"
              >
                Unknown variable{unknownVariables.length === 1 ? "" : "s"}:{" "}
                <span className="font-mono">
                  {unknownVariables.map(variableToken).join(", ")}
                </span>
                . Publishing will be rejected until they are removed or
                corrected.
              </p>
            ) : null}

            {isDraft ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <Button type="submit" disabled={!dirty || save.isPending}>
                  <Save className="h-4 w-4" />
                  {save.isPending ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={dirty || save.isPending || unknownVariables.length > 0}
                  onClick={() => setPublishOpen(true)}
                >
                  <Upload className="h-4 w-4" />
                  Publish…
                </Button>
                {dirty ? (
                  <span className="text-xs text-muted-foreground">
                    Save the draft before publishing or previewing.
                  </span>
                ) : savedAt ? (
                  <span className="text-xs text-success">Draft saved.</span>
                ) : null}
                {save.isError ? (
                  <p className="basis-full text-sm text-destructive" role="alert">
                    {describeSaveError(save.error)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </form>

      <PreviewPanel templateId={template.id} stale={dirty} />

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        template={template}
        kind={kind}
      />
    </div>
  );
}

export function TemplateStatusBadge({ status }: { status: string }) {
  if (status === "published") return <Badge variant="success">Published</Badge>;
  if (status === "draft") return <Badge variant="warning">Draft</Badge>;
  if (status === "archived") return <Badge variant="secondary">Archived</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function VariablePalette({
  kind,
  used,
  unknown,
  disabled,
  onInsert,
}: {
  kind: ContractKind;
  used: string[];
  unknown: string[];
  disabled: boolean;
  onInsert: (name: string) => void;
}) {
  const usedSet = new Set(used);
  return (
    <aside className="rounded-[var(--radius-sm)] border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Braces className="h-3.5 w-3.5" />
        Variables
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Click to insert at the caret. Values are filled in by the server when
        a document is rendered.
      </p>
      <div className="mt-3 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
        {contractVariableGroups(kind).map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-foreground">{group.label}</p>
            <ul className="mt-1 space-y-0.5">
              {group.variables.map((v) => (
                <li key={v.name}>
                  <button
                    type="button"
                    disabled={disabled}
                    title={v.description}
                    onClick={() => onInsert(v.name)}
                    className={cn(
                      "w-full rounded px-1.5 py-0.5 text-left font-mono text-[11px] transition-colors hover:bg-accent-soft disabled:cursor-default disabled:hover:bg-transparent",
                      usedSet.has(v.name)
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {variableToken(v.name)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {unknown.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-destructive">Unknown</p>
            <ul className="mt-1 space-y-0.5">
              {unknown.map((name) => (
                <li
                  key={name}
                  className="px-1.5 py-0.5 font-mono text-[11px] text-destructive"
                >
                  {variableToken(name)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

/** Server preview of the saved template (sample variables substituted). */
function PreviewPanel({
  templateId,
  stale,
}: {
  templateId: string;
  stale: boolean;
}) {
  const preview = useContractPreview(templateId);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4 text-primary" />
            Preview
          </CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={preview.isFetching}
            onClick={() => preview.refetch()}
          >
            {preview.isFetching ? "Rendering…" : "Refresh"}
          </Button>
        </div>
        <CardDescription>
          Rendered by the server from the last saved body with sample values
          for every variable
          {stale ? " — you have unsaved changes that are not reflected yet." : "."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {preview.isLoading ? (
          <LoadingState label="Rendering preview…" className="py-8" />
        ) : preview.isError ? (
          <ErrorState
            title="Could not render the preview"
            message={getErrorMessage(preview.error, "Please try again.")}
            onRetry={() => preview.refetch()}
            className="py-8"
          />
        ) : (
          // Server-rendered from Markdown with variables substituted and HTML
          // escaped (ADR-0010) — the client shows it verbatim.
          <div
            className={cn(CONTRACT_HTML_CLASS, stale && "opacity-60")}
            dangerouslySetInnerHTML={{ __html: preview.data?.html ?? "" }}
          />
        )}
      </CardContent>
    </Card>
  );
}

const publishSchema = z.object({
  requireResign: z.boolean(),
  confirm: z.boolean().refine((v) => v === true, {
    message: "Tick the box to confirm",
  }),
});
type PublishFormValues = z.infer<typeof publishSchema>;

/**
 * Publish confirmation. For the host agreement the admin decides whether
 * every signed host must sign the new version (`requireResign` — hosts are
 * nagged, never blocked). Rental agreements apply to NEW bookings only.
 */
function PublishDialog({
  open,
  onClose,
  template,
  kind,
}: {
  open: boolean;
  onClose: () => void;
  template: ContractTemplateAdminDto;
  kind: ContractKind;
}) {
  const qc = useQueryClient();
  const isHost = kind === "host_agreement";
  const form = useForm<PublishFormValues>({
    resolver: zodResolver(publishSchema),
    defaultValues: { requireResign: false, confirm: false },
  });
  const { reset } = form;
  const mutation = useMutation({
    mutationFn: (values: PublishFormValues) =>
      AdminApi.publishContractTemplate(
        template.id,
        isHost ? values.requireResign : undefined,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.contractTemplates(kind) });
      onClose();
    },
  });
  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) {
      reset({ requireResign: false, confirm: false });
      resetMutation();
    }
  }, [open, reset, resetMutation]);

  const resignId = useId();
  const confirmId = useId();
  const busy = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={`Publish "${template.title}"?`}
      description={
        isHost
          ? "The current published host agreement is archived and this text becomes the version new hosts sign."
          : "The current published rental agreement is archived; every NEW booking request is signed under this text. Existing bookings keep the version they signed."
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        {isHost ? (
          <label
            htmlFor={resignId}
            className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-border p-3 text-sm"
          >
            <input
              id={resignId}
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              disabled={busy}
              {...form.register("requireResign")}
            />
            <span>
              <span className="font-medium text-foreground">
                Require every signed host to sign again
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Hosts see a banner and receive an email. Their listings stay
                live meanwhile; only NEW signatures use this version.
              </span>
            </span>
          </label>
        ) : null}

        <label htmlFor={confirmId} className="flex items-start gap-3 text-sm">
          <input
            id={confirmId}
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            disabled={busy}
            aria-invalid={!!form.formState.errors.confirm}
            {...form.register("confirm")}
          />
          <span className="text-foreground">
            I reviewed the preview and want to publish this version.
          </span>
        </label>
        {form.formState.errors.confirm ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.confirm.message}
          </p>
        ) : null}

        {mutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {describePublishError(mutation.error)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Keep as draft
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Publishing…" : "Publish version"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
