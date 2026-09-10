"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";
import { AgencyApi, agencyKeys, MAX_PHOTOS_PER_CAR } from "@/features/agency/api";
import {
  uploadCarPhotosSequentially,
  validateCarPhotoFile,
  type PhotoUploadProgress,
} from "@/features/agency/car-photo-upload";
import { resolveCarPhotoUrl } from "@/features/cars/photos";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";

/**
 * Manage a car's gallery: multi-file upload with per-file progress/errors,
 * delete, and reorder via move left/right (index 0 = cover — customers see
 * it on every search card). Every mutation refetches the canonical server
 * order, so the grid always reflects what customers will actually see.
 */
export function CarPhotosManager({ carId }: { carId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const galleryQuery = useQuery({
    queryKey: agencyKeys.carPhotos(carId),
    queryFn: () => AgencyApi.carPhotos(carId),
  });

  // ── Upload queue (per-file progress + error rows) ──────────────────────────
  const [queue, setQueue] = useState<
    { name: string; status: PhotoUploadProgress["status"]; percent: number; error?: string }[]
  >([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || uploading) return;

    const picked = Array.from(fileList);
    const errors: string[] = [];
    let accepted = picked.filter((f) => {
      const reason = validateCarPhotoFile(f);
      if (reason) errors.push(`${f.name}: ${reason}`);
      return !reason;
    });

    const room = MAX_PHOTOS_PER_CAR - (galleryQuery.data?.length ?? 0);
    if (accepted.length > room) {
      errors.push(
        `A car can have at most ${MAX_PHOTOS_PER_CAR} photos — only the first ${Math.max(room, 0)} selected file(s) will be uploaded.`,
      );
      accepted = accepted.slice(0, Math.max(room, 0));
    }
    setRejected(errors);
    if (accepted.length === 0) return;

    setUploading(true);
    setQueue(
      accepted.map((f) => ({ name: f.name, status: "uploading", percent: 0 })),
    );
    await uploadCarPhotosSequentially(carId, accepted, (u) =>
      setQueue((prev) =>
        prev.map((row, i) =>
          i === u.index
            ? { ...row, status: u.status, percent: u.percent, error: u.error }
            : row,
        ),
      ),
    );
    setUploading(false);
    setQueue((prev) => prev.filter((row) => row.status === "error"));
    await qc.invalidateQueries({ queryKey: agencyKeys.carPhotos(carId) });
    qc.invalidateQueries({ queryKey: agencyKeys.all });
  }

  // ── Delete & reorder ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => AgencyApi.deleteCarPhoto(carId, photoId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.carPhotos(carId) });
      qc.invalidateQueries({ queryKey: agencyKeys.all });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (photoIds: string[]) =>
      AgencyApi.reorderCarPhotos(carId, photoIds),
    onSuccess: (gallery) => {
      qc.setQueryData(agencyKeys.carPhotos(carId), gallery);
      qc.invalidateQueries({ queryKey: agencyKeys.all });
    },
    onError: () => {
      // A stale set 400s (concurrent change) — refetch the truth.
      qc.invalidateQueries({ queryKey: agencyKeys.carPhotos(carId) });
    },
  });

  function move(index: number, delta: -1 | 1) {
    const photos = galleryQuery.data ?? [];
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const ids = photos.map((p) => p.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  }

  if (galleryQuery.isLoading) return <LoadingState label="Loading photos…" />;
  if (galleryQuery.isError) {
    return (
      <ErrorState
        title="Could not load this car’s photos"
        message={galleryQuery.error.message}
        onRetry={() => galleryQuery.refetch()}
      />
    );
  }

  const photos = galleryQuery.data ?? [];
  const busy = uploading || deleteMutation.isPending || reorderMutation.isPending;
  const full = photos.length >= MAX_PHOTOS_PER_CAR;

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = ""; // allow re-picking the same files
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {photos.length}/{MAX_PHOTOS_PER_CAR} photos · JPEG, PNG or WEBP, up
          to 5 MB each. The first photo is the cover customers see in search.
        </p>
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy || full}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-2 h-4 w-4" />
          )}
          {uploading ? "Uploading…" : full ? "Gallery full" : "Add photos"}
        </Button>
      </div>

      {/* Client-side rejections (format/size/limit). */}
      {rejected.length > 0 ? (
        <ul className="space-y-1 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          {rejected.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      ) : null}

      {/* Per-file upload progress / error rows. */}
      {queue.length > 0 ? (
        <ul className="space-y-2">
          {queue.map((row, i) => (
            <li
              key={`${row.name}-${i}`}
              className="rounded-[var(--radius-sm)] border border-border bg-surface p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{row.name}</span>
                <span
                  className={
                    row.status === "error"
                      ? "text-xs text-red-600"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {row.status === "uploading"
                    ? `${row.percent}%`
                    : row.status === "done"
                      ? "Uploaded"
                      : (row.error ?? "Upload failed")}
                </span>
              </div>
              {row.status === "uploading" ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${row.percent}%` }}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description="Cars with real photos get far more requests. Add up to 10 — the first one becomes the cover."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              className="group relative overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted"
            >
              <div className="relative aspect-[4/3]">
                {/* Plain <img>: API-origin photo on an authed dashboard —
                    no optimizer/allowlist involvement needed. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveCarPhotoUrl(photo.url)}
                  alt={`Car photo ${i + 1}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              {i === 0 ? (
                <Badge className="absolute left-2 top-2" variant="secondary">
                  Cover
                </Badge>
              ) : null}
              <div className="flex items-center justify-between gap-1 border-t border-border bg-surface p-1.5">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move photo earlier"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="Move photo later"
                    disabled={busy || i === photos.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Delete photo"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => deleteMutation.mutate(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteMutation.isError ? (
        <p className="text-sm text-red-600">
          {deleteMutation.error.message}
        </p>
      ) : null}
      {reorderMutation.isError ? (
        <p className="text-sm text-red-600">
          Could not reorder — the gallery changed. It has been refreshed;
          try again.
        </p>
      ) : null}
    </div>
  );
}
