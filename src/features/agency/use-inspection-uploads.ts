"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  InspectionUploadError,
  MAX_INSPECTION_PHOTOS,
  MAX_INSPECTION_VIDEOS,
  MAX_INSPECTION_VIDEO_SECONDS,
  isUploadAborted,
  readVideoDuration,
  uploadInspectionMedia,
  validateInspectionFile,
  type UploadStage,
} from "@/features/agency/inspection-media-upload";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type {
  InspectionDto,
  InspectionMediaDto,
  MediaKind,
  MediaLabel,
} from "@/shared/types/domain";

export type UploadRowStatus = "preparing" | UploadStage | "error";

/** One file in the local upload queue (gone once the server holds it). */
export interface UploadRow {
  localId: string;
  kind: MediaKind;
  label: MediaLabel;
  file: File;
  status: UploadRowStatus;
  /** 0–100 while uploading. */
  percent: number;
  error: string | null;
  /** False when the file itself was rejected client-side (retrying cannot help). */
  retryable: boolean;
  /** The server's `pending_upload` row, discarded before a retry / on remove. */
  mediaId: string | null;
  durationSeconds: number | null;
}

export interface InspectionUploads {
  rows: UploadRow[];
  /** True while any file is still moving — submission waits for it. */
  inFlight: boolean;
  add: (kind: MediaKind, label: MediaLabel, files: File[]) => void;
  retry: (localId: string) => void;
  remove: (localId: string) => void;
  /** Delete a media item the server already holds (draft only). */
  removeUploaded: (mediaId: string) => void;
  removingUploadedId: string | null;
  removeUploadedError: string | null;
}

let sequence = 0;
function nextLocalId(): string {
  sequence += 1;
  return `upload-${sequence}`;
}

/** Copy for the pipeline failures (spec §0.2 media codes); else the message. */
function describeUploadError(error: unknown): string {
  const reason = error instanceof InspectionUploadError ? error.reason : error;
  switch (getApiErrorCode(reason)) {
    case API_ERROR_CODES.MEDIA_LIMIT_EXCEEDED:
      return "This inspection already has the maximum number of files.";
    case API_ERROR_CODES.MEDIA_TOO_LARGE:
      return "The file is larger than the platform allows.";
    case API_ERROR_CODES.MEDIA_TYPE_UNSUPPORTED:
      return "This file type is not accepted.";
    case API_ERROR_CODES.INSPECTION_WRONG_STATE:
      return "This record can no longer be edited.";
    default:
      return getErrorMessage(reason, "Upload failed. Try again.");
  }
}

/**
 * The upload queue of ONE draft inspection: validates files, runs the
 * register → PUT → complete pipeline per file (in parallel — the browser
 * throttles connections), tracks per-file progress/errors, and writes each
 * finished item straight into the cached inspections list so the grid
 * updates without a refetch. Retrying discards the stale pending row and
 * re-registers (the server mints a fresh signed URL); removing aborts an
 * in-flight PUT. Rows live only in this component tree — leaving the page
 * abandons unfinished uploads (the server garbage-collects pending rows).
 */
export function useInspectionUploads(
  bookingId: string,
  inspection: InspectionDto,
): InspectionUploads {
  const qc = useQueryClient();
  const [rows, setRows] = useState<UploadRow[]>([]);
  const rowsRef = useRef<UploadRow[]>([]);
  const inspectionRef = useRef(inspection);
  inspectionRef.current = inspection;
  const controllers = useRef(new Map<string, AbortController>());
  const [removingUploadedId, setRemovingUploadedId] = useState<string | null>(null);
  const [removeUploadedError, setRemoveUploadedError] = useState<string | null>(null);

  const inspectionId = inspection.id;

  // One synchronous source of truth: callbacks read `rowsRef`, React renders `rows`.
  const commit = useCallback((update: (prev: UploadRow[]) => UploadRow[]) => {
    rowsRef.current = update(rowsRef.current);
    setRows(rowsRef.current);
  }, []);

  const patch = useCallback(
    (localId: string, changes: Partial<UploadRow>) =>
      commit((prev) =>
        prev.map((row) => (row.localId === localId ? { ...row, ...changes } : row)),
      ),
    [commit],
  );

  const drop = useCallback(
    (localId: string) => {
      controllers.current.delete(localId);
      commit((prev) => prev.filter((row) => row.localId !== localId));
    },
    [commit],
  );

  const applyUploaded = useCallback(
    (media: InspectionMediaDto) => {
      qc.setQueryData<InspectionDto[]>(agencyKeys.inspections(bookingId), (prev) =>
        prev?.map((item) =>
          item.id === inspectionId
            ? {
                ...item,
                media: [...item.media.filter((m) => m.id !== media.id), media],
              }
            : item,
        ),
      );
    },
    [qc, bookingId, inspectionId],
  );

  const applyDeleted = useCallback(
    (mediaId: string) => {
      qc.setQueryData<InspectionDto[]>(agencyKeys.inspections(bookingId), (prev) =>
        prev?.map((item) =>
          item.id === inspectionId
            ? { ...item, media: item.media.filter((m) => m.id !== mediaId) }
            : item,
        ),
      );
    },
    [qc, bookingId, inspectionId],
  );

  const run = useCallback(
    async (row: UploadRow) => {
      const controller = new AbortController();
      controllers.current.set(row.localId, controller);
      try {
        const media = await uploadInspectionMedia({
          inspectionId,
          kind: row.kind,
          label: row.label,
          file: row.file,
          durationSeconds: row.durationSeconds ?? undefined,
          signal: controller.signal,
          onStage: (stage) => patch(row.localId, { status: stage }),
          onProgress: (percent) => patch(row.localId, { percent }),
        });
        applyUploaded(media);
        drop(row.localId);
      } catch (error) {
        if (isUploadAborted(error)) {
          drop(row.localId);
          return;
        }
        controllers.current.delete(row.localId);
        patch(row.localId, {
          status: "error",
          error: describeUploadError(error),
          retryable: true,
          mediaId: error instanceof InspectionUploadError ? error.mediaId : null,
        });
      }
    },
    [inspectionId, patch, applyUploaded, drop],
  );

  /** Client checks (type/size/length) before the pipeline touches the API. */
  const prepareAndRun = useCallback(
    async (row: UploadRow) => {
      const rejection = validateInspectionFile(row.kind, row.file);
      if (rejection) {
        patch(row.localId, { status: "error", error: rejection, retryable: false });
        return;
      }
      let durationSeconds = row.durationSeconds;
      if (row.kind === "video" && durationSeconds === null) {
        try {
          durationSeconds = await readVideoDuration(row.file);
        } catch (error) {
          patch(row.localId, {
            status: "error",
            error: getErrorMessage(error, "Could not read the video."),
            retryable: false,
          });
          return;
        }
        if (durationSeconds > MAX_INSPECTION_VIDEO_SECONDS) {
          patch(row.localId, {
            status: "error",
            error: `Too long — videos must be ${MAX_INSPECTION_VIDEO_SECONDS} seconds or shorter (this one is ${durationSeconds}s).`,
            retryable: false,
          });
          return;
        }
        patch(row.localId, { durationSeconds });
      }
      await run({ ...row, durationSeconds });
    },
    [patch, run],
  );

  const add = useCallback(
    (kind: MediaKind, label: MediaLabel, files: File[]) => {
      const serverMedia = inspectionRef.current.media;
      let photos =
        serverMedia.filter((m) => m.kind === "photo").length +
        rowsRef.current.filter((r) => r.kind === "photo").length;
      let videos =
        serverMedia.filter((m) => m.kind === "video").length +
        rowsRef.current.filter((r) => r.kind === "video").length;

      const started: UploadRow[] = [];
      for (const file of files) {
        const row: UploadRow = {
          localId: nextLocalId(),
          kind,
          label,
          file,
          status: "preparing",
          percent: 0,
          error: null,
          retryable: true,
          mediaId: null,
          durationSeconds: null,
        };
        const overLimit =
          kind === "photo" ? photos >= MAX_INSPECTION_PHOTOS : videos >= MAX_INSPECTION_VIDEOS;
        if (overLimit) {
          commit((prev) => [
            ...prev,
            {
              ...row,
              status: "error",
              retryable: false,
              error:
                kind === "photo"
                  ? `Photo limit reached — an inspection holds at most ${MAX_INSPECTION_PHOTOS} photos.`
                  : `Video limit reached — an inspection holds at most ${MAX_INSPECTION_VIDEOS} videos.`,
            },
          ]);
          continue;
        }
        if (kind === "photo") photos += 1;
        else videos += 1;
        commit((prev) => [...prev, row]);
        started.push(row);
      }
      for (const row of started) void prepareAndRun(row);
    },
    [commit, prepareAndRun],
  );

  const retry = useCallback(
    (localId: string) => {
      const row = rowsRef.current.find((r) => r.localId === localId);
      if (!row || row.status !== "error" || !row.retryable) return;
      const stale = row.mediaId;
      const fresh: UploadRow = {
        ...row,
        status: "preparing",
        percent: 0,
        error: null,
        mediaId: null,
      };
      patch(localId, fresh);
      const discard = stale
        ? AgencyApi.deleteInspectionMedia(inspectionId, stale).catch(() => undefined)
        : Promise.resolve();
      void discard.then(() => prepareAndRun(fresh));
    },
    [inspectionId, patch, prepareAndRun],
  );

  const remove = useCallback(
    (localId: string) => {
      const row = rowsRef.current.find((r) => r.localId === localId);
      if (!row) return;
      const controller = controllers.current.get(localId);
      if (controller) {
        // The abort handler in `run` drops the row once the PUT is cancelled.
        controller.abort();
        return;
      }
      if (row.mediaId) {
        void AgencyApi.deleteInspectionMedia(inspectionId, row.mediaId).catch(
          () => undefined,
        );
      }
      drop(localId);
    },
    [inspectionId, drop],
  );

  const removeUploaded = useCallback(
    (mediaId: string) => {
      setRemovingUploadedId(mediaId);
      setRemoveUploadedError(null);
      AgencyApi.deleteInspectionMedia(inspectionId, mediaId)
        .then(() => applyDeleted(mediaId))
        .catch((error: unknown) =>
          setRemoveUploadedError(
            getErrorMessage(error, "Could not remove the file. Try again."),
          ),
        )
        .finally(() => setRemovingUploadedId(null));
    },
    [inspectionId, applyDeleted],
  );

  return {
    rows,
    inFlight: rows.some((row) => row.status !== "error"),
    add,
    retry,
    remove,
    removeUploaded,
    removingUploadedId,
    removeUploadedError,
  };
}
