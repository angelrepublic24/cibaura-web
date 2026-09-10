"use client";

import { create } from "zustand";
import type { Role, User } from "@/shared/types/domain";
import { clearUserMarker, setUserMarker } from "@/shared/auth/token";
import { clearQueryCache } from "@/shared/providers/query-client-registry";

/**
 * Client-side session store (zustand). Hydrated by the `useMe` query in
 * `src/features/auth/hooks.ts`; the guard components read from here.
 *
 * Holds ONLY the non-sensitive user snapshot — the credentials themselves
 * live in httpOnly cookies the backend manages (see `shared/api/client.ts`),
 * so nothing here (or anywhere in JS) can leak a token.
 *
 * status:
 *  - "unknown"       -> not hydrated yet (show loading in guarded areas)
 *  - "authenticated" -> `user` is set
 *  - "guest"         -> no session
 */
interface AuthState {
  user: User | null;
  status: "unknown" | "authenticated" | "guest";
  signIn: (user: User) => void;
  setUser: (user: User | null) => void;
  signOut: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  status: "unknown",

  signIn: (user) => {
    // Drop any prior account's cached queries BEFORE the new session's queries
    // run, so a shared browser never bleeds the previous user's data (and useMe
    // can't overwrite the fresh user from a stale /users/me cache).
    clearQueryCache();
    setUserMarker(user.id);
    set({ user, status: "authenticated" });
  },

  setUser: (user) =>
    set({ user, status: user ? "authenticated" : "guest" }),

  /**
   * LOCAL sign-out only (state + marker + caches). Server-side revocation +
   * cookie clearing is `POST /auth/logout` — see `useLogout` in
   * `features/auth/hooks.ts`, which calls the API first and then this.
   */
  signOut: () => {
    clearUserMarker();
    clearQueryCache(); // wipe user-scoped caches (bookings, wallet, verification…)
    set({ user: null, status: "guest" });
  },

  hasRole: (...roles) => {
    const user = get().user;
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  },
}));
