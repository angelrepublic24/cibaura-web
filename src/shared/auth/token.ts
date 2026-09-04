/**
 * Session-marker storage. NO TOKEN LIVES HERE ANYMORE.
 *
 * The session itself rides in the httpOnly cookies the backend sets on
 * login/register/refresh (`cibaura_access` + `cibaura_refresh`, see
 * backend `auth-cookies.ts`) — JS can neither read nor write them, so an
 * XSS can no longer exfiltrate the JWT. The axios client only needs
 * `withCredentials: true`.
 *
 * `cibaura:lastUserId` is a lightweight NON-SENSITIVE marker used to gate
 * auth-only queries so logged-out guests never fire guaranteed-401 requests
 * (pattern mirrored from Beusun's `hasUserMarker`).
 */
const USER_MARKER_KEY = "cibaura:lastUserId";

/** Pre-migration localStorage key that held the raw access JWT. */
const LEGACY_TOKEN_KEY = "cibaura:accessToken";

/**
 * One-time boot cleanup: drop the JWT the pre-cookie web client persisted in
 * localStorage. Idempotent; called from the root provider on every load so
 * no returning browser keeps a readable token around.
 */
export function purgeLegacyTokenStorage(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setUserMarker(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_MARKER_KEY, userId);
}

export function clearUserMarker(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_MARKER_KEY);
}

/**
 * True once a user session has been observed on this browser. Used as the
 * `enabled` gate for auth-only queries (e.g. `/users/me`, `/bookings/mine`).
 */
export function hasUserMarker(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.localStorage.getItem(USER_MARKER_KEY)
  );
}
