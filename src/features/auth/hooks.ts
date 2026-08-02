"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthApi, authKeys } from "@/features/auth/api";
import { useAuthStore } from "@/shared/auth/store";
import { hasUserMarker } from "@/shared/auth/token";

/**
 * Session hydration hook: fetches `/auth/me` (only when a previous session
 * marker exists — guests never fire a guaranteed 401) and mirrors the
 * result into the zustand auth store for guards/menus to read.
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
