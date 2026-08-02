"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useGoogleMaps } from "@/shared/hooks/use-google-maps";

// Google's Autocomplete binds to a real DOM <input>, so we use a raw element
// (the shared <Input> isn't a forwardRef component) with the same styling.
const INPUT_CLASS =
  "flex h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface pl-9 pr-9 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** The bits of a picked place the delivery flow needs. */
export interface PickedAddress {
  formattedAddress: string;
  lat: number;
  lng: number;
}

function parsePlace(
  place: google.maps.places.PlaceResult,
): PickedAddress | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  return {
    formattedAddress: place.formatted_address || place.name || "",
    lat: loc.lat(),
    lng: loc.lng(),
  };
}

/**
 * Google-Places address autocomplete. On selection it emits the formatted
 * address + coordinates (the delivery fee is computed server-side from those).
 * Adapted from Beusun's proven component, styled to the Cibaura design system.
 */
export function AddressAutocomplete({
  onSelect,
  onClear,
  placeholder = "Type your delivery address…",
  id,
}: {
  onSelect: (address: PickedAddress) => void;
  /** Called when the field is edited after a selection (coords no longer valid). */
  onClear?: () => void;
  placeholder?: string;
  id?: string;
}) {
  const { loaded, error } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(false);

  useEffect(() => {
    if (!loaded || !inputRef.current || acRef.current) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      fields: ["formatted_address", "geometry", "name"],
    });
    ac.addListener("place_changed", () => {
      const parsed = parsePlace(ac.getPlace());
      if (parsed) {
        setValue(parsed.formattedAddress);
        setSelected(true);
        onSelect(parsed);
      }
    });
    acRef.current = ac;
  }, [loaded, onSelect]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (selected) {
              setSelected(false);
              onClear?.();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          disabled={!loaded && !error}
          className={INPUT_CLASS}
        />
        {!loaded && !error ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : value && !selected && loaded ? (
        <p className="text-xs text-amber-600">
          Pick an address from the suggestions to get a delivery quote.
        </p>
      ) : null}
    </div>
  );
}
