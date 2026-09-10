"use client";

import { useRef, useState } from "react";
import {
  Camera,
  ImageOff,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { MediaViewerDialog } from "@/features/bookings/components/inspection-media-viewer";
import {
  ALLOWED_INSPECTION_PHOTO_TYPES,
  ALLOWED_INSPECTION_VIDEO_TYPES,
  MAX_INSPECTION_VIDEO_SECONDS,
  REQUIRED_INSPECTION_LABELS,
} from "@/features/agency/inspection-media-upload";
import type {
  InspectionUploads,
  UploadRow,
} from "@/features/agency/use-inspection-uploads";
import type {
  InspectionDto,
  InspectionMediaDto,
  MediaKind,
  MediaLabel,
} from "@/shared/types/domain";
import { mediaLabelText } from "@/shared/utils/lifecycle-labels";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

const PHOTO_ACCEPT = ALLOWED_INSPECTION_PHOTO_TYPES.join(",");
const VIDEO_ACCEPT = ALLOWED_INSPECTION_VIDEO_TYPES.join(",");

/** Sort helper for the media list (server `position`, then id for stability). */
function byPosition(a: InspectionMediaDto, b: InspectionMediaDto): number {
  return a.position - b.position || a.id.localeCompare(b.id);
}

/** Count of the seven guided shots the server already holds. */
export function requiredShotsUploaded(media: InspectionMediaDto[]): number {
  return REQUIRED_INSPECTION_LABELS.filter((label) =>
    media.some((m) => m.kind === "photo" && m.label === label && m.status === "uploaded"),
  ).length;
}

/**
 * The media step of a DRAFT inspection (ADR-0011): one slot per required
 * shot (front, rear, left, right, interior, odometer, fuel), an open list
 * for damage photos, optional extra photos, and one optional walk-around
 * video. Files go straight to storage through signed PUTs with per-file
 * progress, retry and remove (`useInspectionUploads`); what the server
 * already holds renders from the cached inspection with signed URLs.
 */
export function InspectionMediaUploader({
  inspection,
  uploads,
  disabled = false,
}: {
  inspection: InspectionDto;
  uploads: InspectionUploads;
  /** Freeze every control (e.g. while submitting). */
  disabled?: boolean;
}) {
  const media = [...inspection.media].sort(byPosition);
  const uploaded = media.filter((m) => m.status === "uploaded");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const photosFor = (label: MediaLabel) =>
    uploaded.filter((m) => m.kind === "photo" && m.label === label);
  const rowsFor = (kind: MediaKind, label?: MediaLabel) =>
    uploads.rows.filter((r) => r.kind === kind && (label === undefined || r.label === label));
  const videos = uploaded.filter((m) => m.kind === "video");
  const required = requiredShotsUploaded(uploaded);

  const openViewer = (item: InspectionMediaDto) => {
    const index = uploaded.findIndex((m) => m.id === item.id);
    if (index >= 0) setViewerIndex(index);
  };

  const tile = (item: InspectionMediaDto) => (
    <UploadedTile
      key={item.id}
      media={item}
      onOpen={() => openViewer(item)}
      onDelete={() => uploads.removeUploaded(item.id)}
      deleting={uploads.removingUploadedId === item.id}
      disabled={disabled}
    />
  );
  const queueTile = (row: UploadRow) => (
    <QueueTile
      key={row.localId}
      row={row}
      onRetry={() => uploads.retry(row.localId)}
      onRemove={() => uploads.remove(row.localId)}
      disabled={disabled}
    />
  );

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">
            Required shots · {required}/{REQUIRED_INSPECTION_LABELS.length}
          </h4>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG or WEBP up to 10 MB. Whole panel in frame, in daylight.
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {REQUIRED_INSPECTION_LABELS.map((label) => {
            const items = photosFor(label);
            const rows = rowsFor("photo", label);
            return (
              <li
                key={label}
                className={cn(
                  "space-y-2 rounded-[var(--radius-sm)] border p-2",
                  items.length > 0 ? "border-success/40 bg-success-soft/40" : "border-border",
                )}
              >
                <p className="text-xs font-medium text-foreground">
                  {mediaLabelText(label)}
                </p>
                {items.map(tile)}
                {rows.map(queueTile)}
                {items.length === 0 && rows.length === 0 ? (
                  <FilePickButton
                    accept={PHOTO_ACCEPT}
                    label="Add photo"
                    icon="photo"
                    disabled={disabled}
                    onFiles={(files) => uploads.add("photo", label, files.slice(0, 1))}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <MediaSection
        title="Damage photos (optional)"
        hint="Close-ups of every scratch, dent or missing item you found. These are what a claim is built on."
        items={photosFor("damage")}
        rows={rowsFor("photo", "damage")}
        renderItem={tile}
        renderRow={queueTile}
        action={
          <FilePickButton
            accept={PHOTO_ACCEPT}
            label="Add damage photos"
            icon="photo"
            multiple
            disabled={disabled}
            onFiles={(files) => uploads.add("photo", "damage", files)}
          />
        }
      />

      <MediaSection
        title="Additional photos (optional)"
        hint="Anything else worth keeping on record — documents, accessories, the key set."
        items={photosFor("other")}
        rows={rowsFor("photo", "other")}
        renderItem={tile}
        renderRow={queueTile}
        action={
          <FilePickButton
            accept={PHOTO_ACCEPT}
            label="Add photos"
            icon="photo"
            multiple
            disabled={disabled}
            onFiles={(files) => uploads.add("photo", "other", files)}
          />
        }
      />

      <MediaSection
        title={`Walk-around video (optional, up to ${MAX_INSPECTION_VIDEO_SECONDS} s)`}
        hint="MP4 or MOV up to 100 MB. One slow lap around the car."
        items={videos}
        rows={rowsFor("video")}
        renderItem={tile}
        renderRow={queueTile}
        action={
          videos.length === 0 && rowsFor("video").length === 0 ? (
            <FilePickButton
              accept={VIDEO_ACCEPT}
              label="Add video"
              icon="video"
              disabled={disabled}
              onFiles={(files) => uploads.add("video", "other", files.slice(0, 1))}
            />
          ) : null
        }
      />

      {uploads.removeUploadedError ? (
        <p className="text-sm text-destructive" role="alert">
          {uploads.removeUploadedError}
        </p>
      ) : null}

      {viewerIndex !== null ? (
        <MediaViewerDialog
          items={uploaded}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </div>
  );
}

function MediaSection({
  title,
  hint,
  items,
  rows,
  renderItem,
  renderRow,
  action,
}: {
  title: string;
  hint: string;
  items: InspectionMediaDto[];
  rows: UploadRow[];
  renderItem: (item: InspectionMediaDto) => React.ReactNode;
  renderRow: (row: UploadRow) => React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {items.length > 0 || rows.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
          {rows.map((row) => (
            <li key={row.localId}>{renderRow(row)}</li>
          ))}
        </ul>
      ) : null}
      {action}
    </section>
  );
}

/** A file picker that looks like a button (its `<input>` stays hidden). */
function FilePickButton({
  accept,
  label,
  icon,
  multiple = false,
  disabled = false,
  onFiles,
}: {
  accept: string;
  label: string;
  icon: "photo" | "video";
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = icon === "video" ? Video : Camera;
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ""; // allow re-picking the same file after a remove
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
    </>
  );
}

/** A file the server holds: thumbnail (signed URL) + open + delete. */
function UploadedTile({
  media,
  onOpen,
  onDelete,
  deleting,
  disabled,
}: {
  media: InspectionMediaDto;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
  disabled: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const isVideo = media.kind === "video";
  return (
    <div className="group relative overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className="relative block aspect-[4/3] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`Open ${media.kind} — ${mediaLabelText(media.label)}`}
      >
        {!media.url || broken ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <ImageOff className="h-5 w-5" />
            <span className="text-[10px]">
              {media.url ? "Link expired" : "Not available"}
            </span>
          </span>
        ) : isVideo ? (
          <span className="flex h-full w-full items-center justify-center">
            <video
              src={media.url}
              preload="metadata"
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setBroken(true)}
            />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-navy/70 text-cream">
              <Play className="h-4 w-4" />
            </span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL
          <img
            src={media.url}
            alt={mediaLabelText(media.label)}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        )}
      </button>
      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-navy/70 px-1.5 py-0.5 text-[11px] text-cream">
        {isVideo ? <Video className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
        {isVideo && media.durationSeconds !== null
          ? `${media.durationSeconds}s`
          : mediaLabelText(media.label)}
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled || deleting}
        aria-label="Remove file"
        className="absolute right-1.5 top-1.5 rounded-full bg-navy/70 p-1 text-cream hover:bg-destructive disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

const STAGE_COPY: Record<UploadRow["status"], string> = {
  preparing: "Checking the file…",
  registering: "Reserving a slot…",
  uploading: "Uploading…",
  completing: "Verifying…",
  error: "Failed",
};

/** A file still in the local queue: progress, or the error with retry/remove. */
function QueueTile({
  row,
  onRetry,
  onRemove,
  disabled,
}: {
  row: UploadRow;
  onRetry: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const failed = row.status === "error";
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-[var(--radius-sm)] border p-2 text-xs",
        failed ? "border-red-200 bg-red-50" : "border-border bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-foreground" title={row.file.name}>
          {row.file.name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={failed ? "Discard file" : "Cancel upload"}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {failed ? (
        <>
          <p className="text-red-700">{row.error}</p>
          {row.retryable ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onRetry}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {STAGE_COPY[row.status]}
            {row.status === "uploading" ? ` ${row.percent}%` : ""}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${row.status === "uploading" ? row.percent : row.status === "completing" ? 100 : 0}%`,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
