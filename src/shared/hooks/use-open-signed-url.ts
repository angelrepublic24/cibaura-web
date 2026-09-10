"use client";

import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { SignedUrlDto } from "@/shared/types/domain";

/**
 * Open a private file that lives behind a SHORT-LIVED signed URL (contract
 * PDFs, licences, inspection media — ADR-0010/0011). The link is minted on
 * click: the tab is opened SYNCHRONOUSLY (popup blockers allow that inside
 * a click handler) and pointed at the URL once it lands. When the browser
 * still blocks the tab, the signed link is exposed as `fallback` so the
 * caller can render it inline.
 */
export function useOpenSignedUrl(fetcher: () => Promise<SignedUrlDto>) {
  const [fallback, setFallback] = useState<SignedUrlDto | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const tab = window.open("about:blank", "_blank");
      try {
        const signed = await fetcher();
        if (tab) {
          tab.location.href = signed.url;
        } else {
          setFallback(signed);
        }
      } catch (error) {
        // Never leave a blank tab behind when the link could not be minted.
        tab?.close();
        throw error;
      }
    },
  });

  const { mutate } = mutation;
  const open = useCallback(() => {
    setFallback(null);
    mutate();
  }, [mutate]);

  return {
    open,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    fallback,
  };
}
