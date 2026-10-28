import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { authService } from "@/modules/auth/services/auth.service";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
} from "@/modules/auth/types/auth.types";
import { useAuthStore } from "@/shared/auth/store";
import { hasUserMarker } from "@/shared/auth/token";

/** Query keys for the auth module (the only cache this module owns). */
export const authKeys = {
  all: ["auth"] as const,
  me: () => ["auth", "me"] as const,
};

/**
 * A 401 that reached the caller is DEFINITIVE: the axios client already
 * tried (and failed) the cookie refresh, or the 401 carried a credential
 * code the client never refreshes on. Anything else (network, 5xx) is
 * transient and says nothing about the session.
 */
function isUnauthorized(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401;
}

/**
 * Route groups wrapped in a `RoleGuard` (their layouts). Signing out while
 * on one of these races the guard's "guest → /auth/login?next=…" redirect,
 * so those sign-outs finish with a hard navigation home instead.
 */
const GUARDED_PREFIXES = ["/account", "/agency", "/admin"];

function isGuardedPath(pathname: string): boolean {
  return GUARDED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Full-page navigation home. Used after the session ends so (a) the
 * RoleGuard on a protected page can never win the race to
 * `/auth/login?next=…`, and (b) every in-memory cache dies with the
 * session — a fresh document, a fresh QueryClient, nothing to bleed.
 */
function hardNavigateHome(): void {
  window.location.replace("/");
}

/**
 * Session hydration hook: fetches the user with the httpOnly session cookie
 * (only when a previous session marker exists — guests never fire a
 * guaranteed 401) and mirrors the result into the zustand auth store for
 * guards/menus to read. An expired access cookie is refreshed transparently
 * by the axios 401 interceptor before this query ever errors.
 *
 * Only a 401 that survived that refresh ends the session here. A transient
 * failure (offline, 5xx) keeps whatever user is already in the store — a
 * flaky network must never bounce a live session to the login page. The
 * RoleGuard shows an error + retry when there is no user yet to keep.
 */
export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const marker = hasUserMarker();

  const query = useQuery({
    queryKey: authKeys.me(),
    queryFn: () => authService.me(),
    enabled: marker,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!marker) {
      setUser(null); // no prior session -> guest immediately
      return;
    }
    if (query.isSuccess) setUser(query.data);
    else if (query.isError && isUnauthorized(query.error)) setUser(null);
  }, [marker, query.isSuccess, query.isError, query.error, query.data, setUser]);

  return query;
}

/**
 * `POST /auth/login` — the caller passes `onSuccess` to persist the returned
 * user (`signIn`) and route to its destination; `USER_SUSPENDED` surfaces as
 * a coded error for the form to explain.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
  });
}

/**
 * `POST /auth/register` — the caller passes `onSuccess` (persist + route) and
 * `onError` (TERMS_OUTDATED → reload terms, re-ask consent).
 */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
  });
}

/**
 * Full logout: `POST /auth/logout` FIRST — it revokes the refresh token and
 * clears the httpOnly session cookies (something local JS cannot do) — then
 * the local state/marker/caches. Best-effort on the server call: an already
 * dead session (or offline API) must never trap the user signed-in, and the
 * interceptor's refresh-retry covers an expired access cookie.
 *
 * From a guarded route (/account, /agency, /admin) the local sign-out would
 * flip the guard to "guest" and race it to `/auth/login?next=…`; there the
 * logout ends with a hard navigation home instead. On a public page the
 * user simply stays where they are, now as a guest.
 */
export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);
  const pathname = usePathname();
  return useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Session already invalid server-side — local cleanup still applies.
    }
    signOut();
    if (isGuardedPath(pathname)) hardNavigateHome();
  }, [signOut, pathname]);
}

/** `POST /auth/forgot-password` — always 202; the UI never learns if the email exists. */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

/** `POST /auth/reset-password` — the caller maps RESET_TOKEN_INVALID / TERMS_OUTDATED. */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      authService.resetPassword(input),
  });
}

/** `PATCH /auth/change-password` — 401 PASSWORD_INCORRECT = wrong current password (session kept). */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      authService.changePassword(input),
  });
}

/**
 * `PATCH /users/me` — update the SAFE profile fields (name/phone). The caller
 * passes `onSuccess` to mirror the updated user into the store and refresh
 * the `/users/me` cache.
 */
export function useUpdateMe() {
  return useMutation({
    mutationFn: (input: UpdateMeInput) => authService.updateMe(input),
  });
}

/**
 * `DELETE /users/me`. On success the server has already revoked every
 * session; a best-effort `POST /auth/logout` then clears the httpOnly
 * cookies this browser still holds, the local state (marker + caches) is
 * dropped, and a HARD navigation lands on the home page — the account page
 * lives under the RoleGuard, whose guest redirect would otherwise race the
 * client-side navigation and bounce the user to the login form. Errors
 * (PASSWORD_INCORRECT / ACCOUNT_HAS_ACTIVE_BOOKINGS / ACCOUNT_OWNS_AGENCY)
 * are left to the caller to explain.
 */
export function useDeleteAccount() {
  const signOut = useAuthStore((s) => s.signOut);
  return useMutation({
    mutationFn: (password: string) => authService.deleteAccount(password),
    onSuccess: async () => {
      try {
        await authService.logout();
      } catch {
        // Every session is already revoked server-side; nothing to undo.
      }
      signOut();
      hardNavigateHome();
    },
  });
}
