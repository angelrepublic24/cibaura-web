"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AgenciesApi, agencyProfileKeys } from "@/features/agencies/api";
import { useAuthStore } from "@/shared/auth/store";

/** How many per-city links the footer shows at most. */
const MAX_CITY_LINKS = 4;

/**
 * Footer "Explore" column — session-aware. "Become an agency" is hidden once
 * you already manage an agency (owner/staff), and "Log in" is hidden while
 * authenticated. The store is hydrated by <SiteHeader/>'s useMe().
 *
 * City links come from the SAME source the hero search uses — the cities that
 * actually have available cars (`/agencies/available-cities`) — never a
 * hardcoded slug. While loading (or on error) only the generic "Browse cars"
 * entry renders, which searches everywhere.
 */
export function SiteFooterNav() {
  const status = useAuthStore((s) => s.status);
  const hasRole = useAuthStore((s) => s.hasRole);
  const isAgency = hasRole("agency_owner", "agency_staff");
  const isAuthenticated = status === "authenticated";

  const citiesQuery = useQuery({
    queryKey: agencyProfileKeys.availableCities(),
    queryFn: AgenciesApi.availableCities,
    staleTime: 5 * 60_000,
  });
  const cities = (citiesQuery.data ?? []).slice(0, MAX_CITY_LINKS);

  return (
    <nav className="flex flex-col gap-2 text-sm text-cream/80">
      <span className="text-xs font-semibold uppercase tracking-wide text-cream/50">
        Explore
      </span>
      <Link href="/cars/all" className="hover:text-cream">
        Browse cars
      </Link>
      {cities.map((city) => (
        <Link
          key={city.id}
          href={`/cars/${city.slug}`}
          className="hover:text-cream"
        >
          Cars in {city.name}
        </Link>
      ))}
      <Link href="/agencies" className="hover:text-cream">
        Agencies
      </Link>
      {!isAgency ? (
        <Link href="/become-agency" className="hover:text-cream">
          Become an agency
        </Link>
      ) : null}
      {!isAuthenticated ? (
        <Link href="/auth/login" className="hover:text-cream">
          Log in
        </Link>
      ) : null}
    </nav>
  );
}
