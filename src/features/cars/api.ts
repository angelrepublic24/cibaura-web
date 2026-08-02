import { Api } from "@/shared/api/client";
import type {
  Availability,
  Car,
  CarDetail,
  Paginated,
  PickupType,
  Pricing,
} from "@/shared/types/domain";
import type { CarSearchFilters } from "@/features/cars/filters";
import { wholeUnitsToCents } from "@/shared/utils/money";

/**
 * Public cars API module (search + detail + availability + server quote).
 *
 * Backend contract (docs/DOMAIN.md "Wire contract" — every response crosses
 * a serializer; clients code to these shapes, never to DB columns):
 *  - GET  /cars/search   -> Paginated<Car>
 *      (query: cityId, start, end, facets, page, pageSize; availability =
 *       anti-join against CarOccupancy when start/end are present)
 *  - GET  /cars/:carId                 -> CarDetail (public, NO plate;
 *      includes photos[], branch{city}, and the branch's deliveryZones[])
 *  - GET  /cars/:carId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *      -> Availability { carId, occupied: Period[] }  (blocked windows)
 *
 * The pricing preview lives on the bookings surface (POST /bookings/quote),
 * see `features/bookings/api.ts` — clients NEVER compute money.
 */

export const carKeys = {
  all: ["cars"] as const,
  search: (city: string, filters: CarSearchFilters) =>
    ["cars", "search", city, filters] as const,
  detail: (carId: string) => ["cars", "detail", carId] as const,
  availability: (carId: string, from: string, to: string) =>
    ["cars", "availability", carId, from, to] as const,
  quote: (
    carId: string,
    from: string,
    to: string,
    pickup: PickupType,
    deliveryZoneId?: string,
  ) => ["cars", "quote", carId, from, to, pickup, deliveryZoneId ?? null] as const,
};

export const CarsApi = {
  /**
   * Slug-first search. The backend `SearchCarsDto` accepts EITHER a UUID
   * (`cityId`/`makeId`/`modelId`) OR a URL-safe slug (`city`/`make`/`model`)
   * and resolves the slug → id server-side (FleetService.resolveSearchRefs).
   * The web routes carry slugs in the URL, so we send the slug params.
   *
   * `start`/`end` are REQUIRED by the backend (availability is an anti-join
   * against CarOccupancy). Callers must not hit this without dates — the
   * results page gates on `from && to` (see CarSearchResults).
   */
  async search(city: string, filters: CarSearchFilters): Promise<Paginated<Car>> {
    const res = await Api.get("/cars/search", {
      params: {
        // "all" (or empty) = search every city → omit the param entirely.
        city: city && city !== "all" ? city : undefined,
        start: filters.from,
        end: filters.to,
        make: filters.make, // catalog slug (e.g. "toyota")
        model: filters.model, // catalog slug, scoped to make server-side
        yearMin: filters.yearMin,
        yearMax: filters.yearMax,
        color: filters.color,
        category: filters.category,
        transmission: filters.transmission,
        // URL keeps whole units for humans; the API filters on cents.
        // (Unit conversion at the boundary — not price computation.)
        priceMinCents:
          filters.priceMin !== undefined
            ? wholeUnitsToCents(filters.priceMin)
            : undefined,
        priceMaxCents:
          filters.priceMax !== undefined
            ? wholeUnitsToCents(filters.priceMax)
            : undefined,
        page: filters.page,
      },
    });
    return res.data;
  },

  async findById(carId: string): Promise<CarDetail> {
    const res = await Api.get(`/cars/${carId}`);
    return res.data;
  },

  /**
   * Occupied windows in `[from, to)` — the calendar blocks these ranges.
   * Availability reflects the server; the client never decides it.
   */
  async availability(
    carId: string,
    from: string,
    to: string,
  ): Promise<Availability> {
    const res = await Api.get(`/cars/${carId}/availability`, {
      params: { from, to },
    });
    return res.data;
  },
};

export type { Pricing };
