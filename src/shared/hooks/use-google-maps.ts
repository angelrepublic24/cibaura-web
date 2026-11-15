"use client";

import { useEffect, useState } from "react";

/**
 * Lazily loads the Google Maps JS SDK (Places library) once per browser session
 * using NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Mirrors Beusun's loader — a single
 * shared promise so multiple autocompletes don't inject the script twice.
 */
let scriptLoadedPromise: Promise<void> | null = null;
const READY_CALLBACK = "__cibauraMapsReady";
const LOAD_TIMEOUT_MS = 20_000;

declare global {
  interface Window {
    __cibauraMapsReady?: () => void;
  }
}

function hasPlacesLibrary(): boolean {
  return Boolean(
    (window as unknown as { google?: { maps?: { places?: unknown } } }).google
      ?.maps?.places,
  );
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (hasPlacesLibrary()) return Promise.resolve();
  if (scriptLoadedPromise) return scriptLoadedPromise;

  const loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (window.__cibauraMapsReady === ready) delete window.__cibauraMapsReady;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    };
    const ready = () => {
      finish(hasPlacesLibrary() ? undefined : new Error("Address lookup did not become ready. Please try again."));
    };
    window.__cibauraMapsReady = ready;
    const url = new URL("https://maps.googleapis.com/maps/api/js");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("libraries", "places");
    url.searchParams.set("loading", "async");
    url.searchParams.set("callback", READY_CALLBACK);
    script.src = url.href;
    script.async = true;
    script.defer = true;
    // With loading=async, the script's load event does not mean Places is
    // initialized. Only Google's callback is allowed to release consumers.
    script.onerror = () => finish(new Error("Address lookup could not load. Check your connection and try again."));
    const timeout = window.setTimeout(
      () => finish(new Error("Address lookup took too long to load. Please try again.")),
      LOAD_TIMEOUT_MS,
    );
    try {
      document.head.appendChild(script);
    } catch {
      finish(new Error("Address lookup could not load. Please try again."));
    }
  });
  scriptLoadedPromise = loading;
  void loading.catch(() => {
    // A temporary network/CSP failure must not poison every later mount.
    if (scriptLoadedPromise === loading) scriptLoadedPromise = null;
  });
  return loading;
}

export function useGoogleMaps(): { loaded: boolean; error: string | null } {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      setError("Address lookup is not available in this version. Please contact support.");
      return;
    }
    loadGoogleMaps(apiKey)
      .then(() => { if (active) setLoaded(true); })
      .catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : "Address lookup is unavailable right now.");
      });
    return () => { active = false; };
  }, []);

  return { loaded, error };
}
