import { AgencyApi } from "@/features/agency/api";
import type {
  InspectionMediaDto,
  InspectionMediaUploadDto,
  MediaKind,
  MediaLabel,
} from "@/shared/types/domain";

/**
 * Direct-to-storage upload of inspection media (ADR-0011). The API never
 * buffers the files: the client registers the item (`POST …/media` → a
 * `pending_upload` row + a signed PUT), streams the bytes to storage with
 * progress, then calls `complete` so the server HEADs the object and marks
 * it `uploaded`. A failure at any stage surfaces as {@link
 * InspectionUploadError} carrying the stage and the pending media id, so
 * the UI can drop the row and re-register on retry (signed URLs expire).
 */

// ── Limits (mirror of `common/upload/inspection-media.ts`; server enforces) ──

export const MAX_INSPECTION_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_INSPECTION_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_INSPECTION_VIDEO_SECONDS = 30;
/** Per inspection, pending rows included. */
export const MAX_INSPECTION_PHOTOS = 30;
export const MAX_INSPECTION_VIDEOS = 4;

export const ALLOWED_INSPECTION_PHOTO_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const ALLOWED_INSPECTION_VIDEO_TYPES: readonly string[] = [
  "video/mp4",
  "video/quicktime",
];

/** The seven guided shots every inspection needs before submission. */
export const REQUIRED_INSPECTION_LABELS: readonly MediaLabel[] = [
  "front",
  "rear",
  "left",
  "right",
  "interior",
  "odometer",
  "fuel",
];

/** Human-readable rejection reason, or null when the file is acceptable. */
export function validateInspectionFile(kind: MediaKind, file: File): string | null {
  if (kind === "photo") {
    if (!ALLOWED_INSPECTION_PHOTO_TYPES.includes(file.type)) {
      return "Unsupported format — photos must be JPEG, PNG or WEBP.";
    }
    if (file.size > MAX_INSPECTION_PHOTO_BYTES) {
      return "Too large — photos must be 10 MB or smaller.";
    }
    return null;
  }
  if (!ALLOWED_INSPECTION_VIDEO_TYPES.includes(file.type)) {
    return "Unsupported format — videos must be MP4 or MOV.";
  }
  if (file.size > MAX_INSPECTION_VIDEO_BYTES) {
    return "Too large — videos must be 100 MB or smaller.";
  }
  return null;
}

/**
 * Duration of a video file in whole seconds, read from its metadata in a
 * detached `<video>` element (no network, no playback). Rejects when the
 * browser cannot decode the container.
 */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    };
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      cleanup();
      if (!Number.isFinite(seconds)) {
        reject(new Error("Could not read the video length."));
        return;
      }
      resolve(Math.ceil(seconds));
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("This video could not be read by your browser."));
    };
    video.src = url;
  });
}

export type UploadStage = "registering" | "uploading" | "completing";

/** Where an upload failed + the pending row to discard before retrying. */
export class InspectionUploadError extends Error {
  readonly stage: UploadStage;
  readonly mediaId: string | null;
  /** The underlying failure (an axios error for API stages, a plain Error for the PUT). */
  readonly reason: unknown;

  constructor(stage: UploadStage, mediaId: string | null, reason: unknown) {
    super(reason instanceof Error && reason.message ? reason.message : "Upload failed");
    this.name = "InspectionUploadError";
    this.stage = stage;
    this.mediaId = mediaId;
    this.reason = reason;
  }
}

/** Forbidden request headers the browser sets itself (spec: never via setRequestHeader). */
const BROWSER_MANAGED_HEADERS = new Set(["content-length", "host"]);

/**
 * PUT the file to the signed URL with progress events (XHR — `fetch` has no
 * upload progress). Sends the headers the signature was computed with and
 * the declared Content-Type; Content-Length comes from the blob, which is
 * why `sizeBytes` must equal `file.size` at registration.
 */
function putToSignedUrl(
  upload: InspectionMediaUploadDto["upload"],
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    xhr.withCredentials = false;

    let contentTypeSet = false;
    for (const [name, value] of Object.entries(upload.headers)) {
      const lower = name.toLowerCase();
      if (BROWSER_MANAGED_HEADERS.has(lower)) continue;
      if (lower === "content-type") contentTypeSet = true;
      xhr.setRequestHeader(name, value);
    }
    if (!contentTypeSet) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 403
              ? "The upload link expired before the file was sent."
              : `Storage rejected the upload (HTTP ${xhr.status}).`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new Error("Network error while uploading — check your connection."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", abort);

    xhr.send(file);
  });
}

export interface UploadInspectionMediaInput {
  inspectionId: string;
  kind: MediaKind;
  label: MediaLabel;
  file: File;
  /** Required for videos — read with {@link readVideoDuration}. */
  durationSeconds?: number;
  onProgress?: (percent: number) => void;
  /** Fired when the pipeline enters each stage (for status copy). */
  onStage?: (stage: UploadStage) => void;
  signal?: AbortSignal;
}

/**
 * The whole pipeline for ONE file: register → PUT → complete. Resolves with
 * the server's `InspectionMediaDto` (status `uploaded`, signed URL). Throws
 * {@link InspectionUploadError}; callers retry by deleting `mediaId` (when
 * set) and calling this again — the server mints a fresh signed URL.
 */
export async function uploadInspectionMedia(
  input: UploadInspectionMediaInput,
): Promise<InspectionMediaDto> {
  const { inspectionId, kind, label, file, durationSeconds, signal } = input;
  const onProgress = input.onProgress ?? (() => undefined);
  const onStage = input.onStage ?? (() => undefined);

  let registered: InspectionMediaUploadDto;
  onStage("registering");
  try {
    registered = await AgencyApi.registerInspectionMedia(inspectionId, {
      kind,
      label,
      contentType: file.type,
      sizeBytes: file.size,
      ...(kind === "video" ? { durationSeconds } : {}),
    });
  } catch (reason) {
    throw new InspectionUploadError("registering", null, reason);
  }

  const mediaId = registered.media.id;
  onStage("uploading");
  try {
    await putToSignedUrl(registered.upload, file, onProgress, signal);
  } catch (reason) {
    throw new InspectionUploadError("uploading", mediaId, reason);
  }

  onStage("completing");
  try {
    return await AgencyApi.completeInspectionMedia(inspectionId, mediaId);
  } catch (reason) {
    throw new InspectionUploadError("completing", mediaId, reason);
  }
}

/** True for a cancellation (the user removed the row mid-upload) — not an error to show. */
export function isUploadAborted(error: unknown): boolean {
  const reason = error instanceof InspectionUploadError ? error.reason : error;
  return reason instanceof DOMException && reason.name === "AbortError";
}
