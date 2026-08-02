"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * App-wide React Query defaults (mirrors Beusun's provider):
 * `staleTime: 30s` so page mounts / tab refocus don't re-fire every
 * query and burn the backend's auth-tier rate limit; retries with
 * exponential backoff cover transient cold-start hiccups.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60 * 1000,
        retry: 2,
        retryDelay: (attempt) => Math.min(8_000, 500 * 2 ** attempt),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export default function QueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lazy initial state so the QueryClient survives HMR and is created
  // exactly once per browser session — but not at module scope (which
  // would leak between SSR renders in some hosts).
  const [client] = useState(makeQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
