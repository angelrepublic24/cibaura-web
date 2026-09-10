/**
 * Car photo URL helpers — REAL photos only.
 *
 * The wire serializes uploaded photos as API paths (`/cars/photos/:photoId`
 * — a public streaming endpoint keyed by photo id) and passes seed-era
 * absolute URLs through unchanged. These helpers resolve an API path against
 * the configured API origin and expose the car's real gallery.
 *
 * There is NO stock-photo substitution anymore: a car with no photos renders
 * the branded `CarPhotoPlaceholder` — never someone else's car.
 */
import { API_URL } from "@/lib/config";
import type { Car, CarDetail } from "@/shared/types/domain";

/**
 * Resolve one wire photo URL to something an `<img>`/`next/image` can load:
 * absolute http(s) URLs pass through; API paths (`/cars/photos/:id`) are
 * prefixed with the API base (which already ends in `/api` — see lib/config).
 */
export function resolveCarPhotoUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

/**
 * The primary card photo for a car, or `null` when it has none (callers
 * render the branded placeholder).
 */
export function carPhoto(car: Pick<Car, "primaryPhoto">): string | null {
  return car.primaryPhoto ? resolveCarPhotoUrl(car.primaryPhoto) : null;
}

/** The car's real gallery (resolved URLs, server order). Empty when none. */
export function carGallery(
  car: Pick<CarDetail, "photos" | "primaryPhoto">,
): string[] {
  if (car.photos && car.photos.length > 0) {
    return car.photos.map(resolveCarPhotoUrl);
  }
  // Older payloads may carry only primaryPhoto — still real, never stock.
  return car.primaryPhoto ? [resolveCarPhotoUrl(car.primaryPhoto)] : [];
}
