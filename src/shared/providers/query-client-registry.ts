import type { QueryClient } from "@tanstack/react-query";

/**
 * A module-level handle to the app's single QueryClient (which is created inside
 * QueryProvider, not at module scope). Lets non-React code — the zustand auth
 * store — clear every cached query on login/logout, so one account's data never
 * bleeds into the next session on a shared browser.
 */
let active: QueryClient | null = null;

export function setActiveQueryClient(client: QueryClient): void {
  active = client;
}

/** Drop all cached queries + mutations. Call on every auth transition. */
export function clearQueryCache(): void {
  active?.clear();
}
