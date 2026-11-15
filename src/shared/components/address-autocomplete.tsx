"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useGoogleMaps } from "@/shared/hooks/use-google-maps";
import { recognizedAirport } from "@/shared/helpers/address-airports";

// Google's Autocomplete binds to a real DOM <input>, so we use a raw element
// (the shared <Input> isn't a forwardRef component) with the same styling.
const INPUT_CLASS =
  "flex h-10 w-full rounded-[var(--radius-sm)] border border-border bg-surface pl-9 pr-9 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50";

/** The bits of a picked place the delivery flow needs. */
export interface PickedAddress {
  formattedAddress: string;
  lat: number;
  lng: number;
  /**
   * La ciudad (localidad) del lugar elegido. El backend decide con ella si la
   * agencia cubre esa dirección (`deliversTo`): sin ciudad, una agencia con
   * cobertura configurada rechaza la entrega con 400. `undefined` si Google no
   * la devolvió en los componentes de la dirección.
   */
  city?: string;
}

/**
 * La ciudad de una dirección de Google. Se prueba, en orden, los tipos de
 * componente que distintos países usan para "ciudad" (localidad; el 2.º/3.er
 * nivel administrativo, que es donde suele caer en RD; o postal_town). El
 * backend hace un match flexible por nombre, así que basta el long_name.
 */
function cityFromComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string | undefined {
  if (!components) return undefined;
  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name;
  return (
    byType("locality") ||
    byType("administrative_area_level_2") ||
    byType("administrative_area_level_3") ||
    byType("postal_town") ||
    undefined
  );
}

function parsePlace(
  place: google.maps.places.PlaceResult,
): PickedAddress | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const lat = loc.lat();
  const lng = loc.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return null;
  return {
    formattedAddress: place.formatted_address || place.name || "",
    lat,
    lng,
    city: cityFromComponents(place.address_components),
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
  placeholder = "Address, airport name or code (e.g. STI)",
  id,
  countryCode = "DO",
}: {
  onSelect: (address: PickedAddress) => void;
  /** Any typed edit invalidates the parent's previously confirmed coordinates. */
  onClear?: () => void;
  placeholder?: string;
  id?: string;
  /** Country of the rental/branch, rather than the customer's residence. */
  countryCode?: string;
}) {
  const { loaded, error: loadError } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<google.maps.places.Autocomplete | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  const [value, setValue] = useState("");
  const [selected, setSelected] = useState(false);
  // El constructor legacy de Autocomplete puede lanzar aunque el script cargue
  // (Google lo deprecó para claves nuevas en 2025). Sin esta guarda, el throw
  // escalaba al error boundary global y tumbaba la página entera (BUG-007).
  const [initError, setInitError] = useState<string | null>(null);
  const error = loadError ?? initError;
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportError, setAirportError] = useState<string | null>(null);
  const airportRequest = useRef(0);
  const airportBusy = useRef(false);
  const airportTimer = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const countryRef = useRef(countryCode);
  countryRef.current = countryCode;
  const airport = recognizedAirport(value, countryCode);

  useEffect(() => () => {
    airportRequest.current += 1;
    airportBusy.current = false;
    if (airportTimer.current !== null) window.clearTimeout(airportTimer.current);
  }, []);

  const cancelAirportLookup = () => {
    airportRequest.current += 1;
    airportBusy.current = false;
    if (airportTimer.current !== null) window.clearTimeout(airportTimer.current);
    airportTimer.current = null;
    setAirportLoading(false);
    setAirportError(null);
  };

  const findAirport = async () => {
    const requested = recognizedAirport(valueRef.current, countryRef.current);
    if (!requested || !loaded || loadError || airportBusy.current) return;
    if (!window.google?.maps?.Geocoder) {
      setAirportError("Airport lookup is unavailable right now. Please try again later.");
      return;
    }
    airportBusy.current = true;
    const request = ++airportRequest.current;
    const requestedCountry = countryRef.current;
    setAirportLoading(true);
    setAirportError(null);
    const timer = window.setTimeout(() => {
      if (request !== airportRequest.current) return;
      airportRequest.current += 1;
      airportBusy.current = false;
      airportTimer.current = null;
      setAirportLoading(false);
      setAirportError("Airport lookup took too long. Please try again.");
    }, 20_000);
    airportTimer.current = timer;
    try {
      const response = await new google.maps.Geocoder().geocode({
        address: requested.query,
        componentRestrictions: { country: "DO" },
      });
      if (request !== airportRequest.current || requestedCountry !== countryRef.current) return;
      const result = response.results.find((item) => item.types.includes("airport") && item.formatted_address.trim());
      const parsed = result ? parsePlace({
        formatted_address: result.formatted_address,
        geometry: { location: result.geometry.location },
        address_components: result.address_components,
      }) : null;
      if (!parsed) {
        setAirportError("We couldn't confirm this airport. Try its full name and select an airport from the suggestions.");
        return;
      }
      valueRef.current = parsed.formattedAddress;
      setValue(parsed.formattedAddress);
      setSelected(true);
      onSelectRef.current(parsed);
    } catch {
      if (request === airportRequest.current) {
        setAirportError("Airport lookup is unavailable right now. Please try again later.");
      }
    } finally {
      window.clearTimeout(timer);
      if (airportTimer.current === timer) airportTimer.current = null;
      if (request === airportRequest.current) {
        airportBusy.current = false;
        setAirportLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!loaded || !inputRef.current || acRef.current) return;
    if (!window.google?.maps?.places?.Autocomplete) {
      setInitError("Address lookup is unavailable right now.");
      return;
    }
    let active = true;
    try {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        // Include establishments such as airports and hotels as well as street
        // addresses. An address-only restriction hides valid delivery places.
        fields: [
          "formatted_address",
          "geometry",
          "name",
          "address_components",
        ],
      });
      const listener = ac.addListener("place_changed", () => {
        if (!active) return;
        airportRequest.current += 1;
        airportBusy.current = false;
        if (airportTimer.current !== null) window.clearTimeout(airportTimer.current);
        airportTimer.current = null;
        setAirportLoading(false);
        setAirportError(null);
        const parsed = parsePlace(ac.getPlace());
        if (parsed) {
          valueRef.current = parsed.formattedAddress;
          setValue(parsed.formattedAddress);
          setSelected(true);
          onSelectRef.current(parsed);
        } else {
          setSelected(false);
          onClearRef.current?.();
        }
      });
      acRef.current = ac;
      return () => {
        active = false;
        listener.remove();
        acRef.current = null;
      };
    } catch {
      // Un fallo del autocompletado NO debe tumbar el checkout: lo mostramos
      // como un aviso en el campo. El cliente puede elegir recogida en sucursal.
      setInitError("Address lookup is unavailable right now.");
    }
    return undefined;
  }, [loaded]);

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
            cancelAirportLookup();
            valueRef.current = e.target.value;
            setValue(e.target.value);
            setSelected(false);
            onClear?.();
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
      {airport && !selected ? (
        <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">{airport.code} — {airport.name}</p>
          <button
            type="button"
            disabled={!loaded || !!loadError || airportLoading}
            onClick={findAirport}
            className="text-xs font-medium text-primary underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {airportLoading ? "Finding airport…" : "Find airport location"}
          </button>
        </div>
      ) : null}
      {airportError ? <p role="alert" className="text-xs text-destructive">{airportError}</p> : null}
      {error && !selected ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : value && !selected && loaded ? (
        <p className="text-xs text-amber-600">
          Select an address or airport from the suggestions to confirm its location.
        </p>
      ) : !value ? (
        <p className="text-xs text-muted-foreground">Search an address, hotel, airport name or airport code.</p>
      ) : null}
    </div>
  );
}
