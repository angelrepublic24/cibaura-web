"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AgenciesApi,
  applyKeys,
  type AgencyDocument,
  type AgencyDocumentType,
} from "@/features/agencies/api";
import { getErrorMessage } from "@/shared/api/errors";
import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";

/** One required entity-KYC document slot. */
export interface RequiredAgencyDocument {
  type: AgencyDocumentType;
  label: string;
  hint: string;
}

const DOC_TYPE_LABELS: Record<AgencyDocumentType, string> = {
  business_registration: "Business registration",
  owner_id: "Owner ID — front",
  owner_id_back: "Owner ID — back",
  other: "Other document",
};

/** Human label for a wire document `type`; unknown types show verbatim. */
export function agencyDocumentTypeLabel(type: string): string {
  const labels: Record<string, string | undefined> = DOC_TYPE_LABELS;
  return labels[type] ?? type;
}

export function formatUploadedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Shared file-input styling for the document pickers. */
export const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-[var(--radius-sm)] border border-border bg-surface text-sm text-muted-foreground shadow-sm transition-colors hover:border-border-strong file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-border file:bg-muted file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-border disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Uploads the agency's entity-KYC documents (`POST /agencies/documents`,
 * replace-by-type). Shared by the business application and the individual
 * host wizard; the caller passes which slots are required and the current
 * documents (from `GET /agencies/my-documents`), which are re-fetched after
 * every upload.
 */
export function AgencyDocumentUploader({
  required,
  existing,
  idPrefix = "doc",
}: {
  required: RequiredAgencyDocument[];
  existing: AgencyDocument[];
  idPrefix?: string;
}) {
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: ({ file, type }: { file: File; type: AgencyDocumentType }) =>
      AgenciesApi.uploadDocument(file, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: applyKeys.myDocuments() });
    },
  });

  function onPick(
    type: AgencyDocumentType,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-picked (e.g. after an error).
    e.target.value = "";
    if (!file) return;
    upload.mutate({ file, type });
  }

  return (
    <div className="space-y-5">
      {required.map(({ type, label, hint }) => {
        const current = existing.find((d) => d.type === type);
        const uploadingThis =
          upload.isPending && upload.variables?.type === type;
        const errorThis = upload.isError && upload.variables?.type === type;
        return (
          <div key={type} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`${idPrefix}-${type}`}>{label}</Label>
              {current ? (
                <Badge variant="success">Uploaded</Badge>
              ) : (
                <Badge variant="secondary">Required</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{hint}</p>
            <input
              id={`${idPrefix}-${type}`}
              type="file"
              accept="application/pdf,image/*"
              disabled={uploadingThis}
              onChange={(e) => onPick(type, e)}
              className={FILE_INPUT_CLASS}
            />
            {uploadingThis ? (
              <p className="text-xs text-muted-foreground">Uploading…</p>
            ) : current ? (
              <p className="text-xs text-muted-foreground">
                Current: {current.filename}. Pick a new file to replace it.
              </p>
            ) : null}
            {errorThis ? (
              <p className="text-sm text-destructive" role="alert">
                {getErrorMessage(upload.error, "The upload failed. Try again.")}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
