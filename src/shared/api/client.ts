import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_URL } from "@/lib/config";
import { useAuthStore } from "@/shared/auth/store";

/**
 * Single axios instance for the whole app (mirrors Beusun `global/Global.ts`).
 *
 * SESSION TRANSPORT: httpOnly cookies ONLY (`cibaura_access` /
 * `cibaura_refresh`, set by the backend on login/register/refresh — see
 * backend `auth-cookies.ts`). `withCredentials: true` makes them ride on
 * every request; no Authorization header is ever attached and no token is
 * readable from JS. CSRF stance: SameSite=Lax cookies + the backend's strict
 * CORS origin allowlist (all state-changing routes are non-GET).
 */
export const Api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

/**
 * Bare client for the refresh call itself — NO interceptors, so a failing
 * refresh can never recurse back into the 401 handling below. The refresh
 * token travels in the httpOnly `cibaura_refresh` cookie (Path=
 * /api/auth/refresh); the body stays empty on the web.
 */
const RefreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

/**
 * Endpoints where a 401 means "the credentials IN THIS REQUEST are wrong"
 * (bad login, wrong current password, dead refresh token) — NOT "the session
 * expired". Refresh-and-retry or signing the user out would be wrong there.
 */
const NO_REFRESH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/change-password",
];

/**
 * Single-flight cookie refresh: concurrent 401s (a page mounting several
 * auth-only queries at once) all await the SAME `POST /auth/refresh` instead
 * of stampeding the rotation endpoint. Resolves `true` when the backend
 * rotated the session (fresh cookies are already set), `false` when the
 * session is truly dead.
 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= RefreshClient.post("/auth/refresh", {})
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

/**
 * The refresh cookie is dead → the session is over. Flip the store to guest
 * (clears the marker + user-scoped query caches); the RoleGuard then
 * redirects protected pages to `/auth/login?next=<path>`. No-op for guests
 * so a stray 401 can't wipe public caches.
 */
function onSessionExpired(): void {
  const store = useAuthStore.getState();
  if (store.status !== "guest") store.signOut();
}

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

/**
 * Surface the backend's error message on `error.message` so callers that
 * read `e?.message` get the real NestJS message instead of a generic
 * "Request failed with status code 400". The original AxiosError is
 * preserved, so `e.response.data` still works.
 *
 * On 401 (outside the credential endpoints): attempt ONE cookie-based
 * refresh, then replay the original request. A failed refresh ends the
 * session (state cleared, guard redirects to login).
 *
 * A 401 that carries a stable `code` (PASSWORD_INCORRECT, USER_SUSPENDED…)
 * is a credential VERDICT about this request, not an expired access cookie:
 * the session is either intact or definitively gone, so a refresh would be
 * pointless (and the sign-out on its failure wrong). Those reject at once;
 * only UNCODED 401s take the refresh path.
 */
Api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string | string[]; code?: unknown }>) => {
    const data = error.response?.data;
    const backendMessage = Array.isArray(data?.message)
      ? data?.message.join(", ")
      : data?.message;
    if (backendMessage) error.message = backendMessage;

    const config = error.config as RetriableConfig | undefined;
    const url = config?.url ?? "";
    const codedVerdict = typeof data?.code === "string";
    if (
      error.response?.status === 401 &&
      !codedVerdict &&
      config &&
      !config._retried &&
      !NO_REFRESH_PATHS.some((p) => url.startsWith(p))
    ) {
      if (await refreshSession()) {
        config._retried = true; // exactly one replay per request
        return Api.request(config);
      }
      onSessionExpired();
    }

    return Promise.reject(error);
  },
);
