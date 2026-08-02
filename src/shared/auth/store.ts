"use client";

import { create } from "zustand";
import type { Role, User } from "@/shared/types/domain";
import {
  clearAccessToken,
  clearUserMarker,
  setAccessToken,
  setUserMarker,
} from "@/shared/auth/token";

/**
 * Client-side session store (zustand). Hydrated by the `useMe` query in
 * `src/features/auth/hooks.ts`; the guard components read from here.
 *
 * status:
 *  - "unknown"       -> not hydrated yet (show loading in guarded areas)
 *  - "authenticated" -> `user` is set
 *  - "guest"         -> no session
 */
interface AuthState {
  user: User | null;
  status: "unknown" | "authenticated" | "guest";
  signIn: (user: User, accessToken?: string) => void;
  setUser: (user: User | null) => void;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  status: "unknown",

  signIn: (user, accessToken) => {
    if (accessToken) setAccessToken(accessToken);
    setUserMarker(user.id);
    set({ user, status: "authenticated" });
  },

  setUser: (user) =>
    set({ user, status: user ? "authenticated" : "guest" }),

  signOut: () => {
    clearAccessToken();
    clearUserMarker();
    set({ user: null, status: "guest" });
  },

  hasRole: (...roles) => {
    const user = get().user;
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  },
}));
