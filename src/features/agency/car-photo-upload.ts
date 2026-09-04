import {
  AgencyApi,
  ALLOWED_CAR_PHOTO_TYPES,
  MAX_CAR_PHOTO_BYTES,
} from "@/features/agency/api";

/**
 * Shared client-side upload plumbing for car gallery photos, used by the
 * new-car form and the manage-photos surface. The server re-validates
 * everything (type whitelist, 5MB/file, 10 photos/car) — these checks just
 * give instant, friendlier feedback.
 */

/** Human-readable rejection reason, or null when the file is acceptable. */
export function validateCarPhotoFile(file: File): string | null {
  if (!ALLOWED_CAR_PHOTO_TYPES.includes(file.type)) {
    return "Unsupported format — use JPEG, PNG or WEBP.";
  }
  if (file.size > MAX_CAR_PHOTO_BYTES) {
    return "Too large — photos must be 5 MB or smaller.";
  }
  return null;
}

export interface PhotoUploadProgress {
  /** Index into the files array. */
  index: number;
  status: "uploading" | "done" | "error";
  /** 0–100 while uploading. */
  percent: number;
  error?: string;
}

/**
 * Upload files ONE BY ONE (per-file progress + per-file errors; order is
 * preserved because the backend appends in request order). Reports progress
 * through `onProgress`; never throws — failures are reported per file.
 * Returns how many files uploaded successfully.
 */
export async function uploadCarPhotosSequentially(
  carId: string,
  files: File[],
  onProgress: (update: PhotoUploadProgress) => void,
): Promise<number> {
  let uploaded = 0;
  for (let index = 0; index < files.length; index++) {
    onProgress({ index, status: "uploading", percent: 0 });
    try {
      await AgencyApi.uploadCarPhoto(carId, files[index], (percent) =>
        onProgress({ index, status: "uploading", percent }),
      );
      uploaded += 1;
      onProgress({ index, status: "done", percent: 100 });
    } catch (err) {
      onProgress({
        index,
        status: "error",
        percent: 0,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }
  return uploaded;
}
