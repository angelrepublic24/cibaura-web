"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { HostAddressValues, HostPersonalValues } from "./host-schemas";

/**
 * Local progress of the `/become-host` wizard BEFORE the application is
 * submitted (steps 1–2 are one `POST /agencies/apply-individual`, so until
 * then nothing exists server-side). Persisted in localStorage so a refresh
 * resumes on the same step with the typed values; scoped to the signed-in
 * user so a shared browser never shows someone else's draft. From step 3 on
 * the server is the source of truth (documents, agreement, first car) and
 * the draft is cleared.
 *
 * Hydration is deferred (`skipHydration`) — the wizard calls `rehydrate()`
 * in an effect so the server-rendered markup and the first client render
 * agree, then flips `hydrated`.
 */

export type HostLocalStep = "personal" | "address";

interface HostOnboardingState {
  userId: string | null;
  step: HostLocalStep;
  personal: HostPersonalValues | null;
  address: HostAddressValues | null;
  hydrated: boolean;
  /** Attach the draft to a user; a different user's draft is discarded. */
  bind: (userId: string) => void;
  savePersonal: (values: HostPersonalValues) => void;
  saveAddress: (values: HostAddressValues) => void;
  goTo: (step: HostLocalStep) => void;
  clear: () => void;
  setHydrated: () => void;
}

const EMPTY = {
  userId: null,
  step: "personal" as const,
  personal: null,
  address: null,
};

export const useHostOnboardingStore = create<HostOnboardingState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      hydrated: false,
      bind: (userId) => {
        if (get().userId !== userId) set({ ...EMPTY, userId });
      },
      savePersonal: (values) => set({ personal: values, step: "address" }),
      saveAddress: (values) => set({ address: values }),
      goTo: (step) => set({ step }),
      clear: () => set({ ...EMPTY, userId: get().userId }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "cibaura.host-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        userId: s.userId,
        step: s.step,
        personal: s.personal,
        address: s.address,
      }),
      skipHydration: true,
    },
  ),
);
