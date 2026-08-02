"use client";

import { useEffect, useState } from "react";

/**
 * Lazily loads the Google Maps JS SDK (Places library) once per browser session
 * using NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Mirrors Beusun's loader — a single
 * shared promise so multiple autocompletes don't inject the script twice.
 */
let scriptLoadedPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (
    (window as unknown as { google?: { maps?: { places?: unknown } } }).google
      ?.maps?.places
  ) {
    return Promise.resolve();
  }
  if (scriptLoadedPromise) return scriptLoadedPromise;

  scriptLoadedPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return scriptLoadedPromise;
}

export function useGoogleMaps(): { loaded: boolean; error: string | null } {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("Google Maps is not configured");
      return;
    }
    loadGoogleMaps(apiKey)
      .then(() => setLoaded(true))
      .catch((e) => setError((e as Error).message));
  }, []);

  return { loaded, error };
}
