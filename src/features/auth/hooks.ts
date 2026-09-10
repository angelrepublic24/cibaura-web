"use client";

import { useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthApi, authKeys } from "@/features/auth/api";
import { useAuthStore } from "@/shared/auth/store";
import { hasUserMarker } from "@/shared/auth/token";

/**
 * Session hydration hook: fetches the user with the httpOnly session cookie
 * (only when a previous session marker exists — guests never fire a
 * guaranteed 401) and mirrors the result into the zustand auth store for
 * guards/menus to read. An expired access cookie is refreshed transparently
 * by the axios 401 interceptor before this query ever errors.
 */
export function useMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const marker = hasUserMarker();

  const query = useQuery({
    queryKey: authKeys.me(),
    queryFn: AuthApi.me,
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
    else if (query.isError) setUser(null);
  }, [marker, query.isSuccess, query.isError, query.data, setUser]);

  return query;
}

/**
 * Full logout: `POST /auth/logout` FIRST — it revokes the refresh token and
 * clears the httpOnly session cookies (something local JS cannot do) — then
 * the local state/marker/caches. Best-effort on the server call: an already
 * dead session (or offline API) must never trap the user signed-in, and the
 * interceptor's refresh-retry covers an expired access cookie.
 */
export function useLogout() {
  const signOut = useAuthStore((s) => s.signOut);
  return useCallback(async () => {
    try {
      await AuthApi.logout();
    } catch {
      // Session already invalid server-side — local cleanup still applies.
    }
    signOut();
  }, [signOut]);
}
