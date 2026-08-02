/**
 * Access-token storage skeleton.
 *
 * The backend issues a bearer token at login/register (exact transport —
 * httpOnly cookie vs Authorization header — is finalized by the integrator;
 * the axios client supports both: `withCredentials` is on AND a Bearer
 * header is attached when a token is present here).
 *
 * `cibaura:lastUserId` is a lightweight marker used to gate auth-only
 * queries so logged-out guests never fire guaranteed-401 requests
 * (pattern mirrored from Beusun's `hasUserMarker`).
 */
const TOKEN_KEY = "cibaura:accessToken";
const USER_MARKER_KEY = "cibaura:lastUserId";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
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
 * `enabled` gate for auth-only queries (e.g. `/auth/me`, `/bookings/me`).
 */
export function hasUserMarker(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.localStorage.getItem(USER_MARKER_KEY)
  );
}
