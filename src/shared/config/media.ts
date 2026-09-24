import { API_URL, MEDIA_URL } from "@/lib/config";

/** Must match next.config.ts: unconfigured hosts are never sent to the optimizer. */
export function isOptimizableImage(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  const api = new URL(API_URL);
  const photoPrefix = `${api.pathname}/cars/photos/`;
  if (
    url.origin === api.origin &&
    url.pathname.startsWith(photoPrefix) &&
    /^[^/]+$/.test(url.pathname.slice(photoPrefix.length)) &&
    !url.search
  )
    return true;
  return (
    !!MEDIA_URL &&
    url.origin === MEDIA_URL.origin &&
    url.pathname.startsWith(MEDIA_URL.pathname)
  );
}
