import { Api } from "@/shared/api/client";
import type {
  Availability,
  Car,
  CarDetail,
  Paginated,
} from "@/shared/types/domain";
import {
  availabilityWireSchema,
  carDetailWireSchema,
  carPageWireSchema,
} from "@/modules/cars/schema/cars.schema";
import {
  carCatalogParams,
  carSearchParams,
} from "@/modules/cars/helpers/cars.helper";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";

/**
 * Public cars API client — the ONLY thing in the module that talks to the
 * backend. Hooks call these, components call hooks.
 *
 * Backend contract (docs/DOMAIN.md "Wire contract" — every response crosses
 * a serializer; clients code to these shapes, never to DB columns):
 *  - GET /cars/catalog   -> Paginated<Car>  (published inventory, no dates)
 *  - GET /cars/search    -> Paginated<Car>
 *      (query: city/cityId, start, end, facets, page, pageSize;
 *       availability = anti-join against CarOccupancy)
 *  - GET /cars/:carId    -> CarDetail (public, NO plate; photos[],
 *      branch{city} and the branch's active deliveryZones[])
 *  - GET /cars/:carId/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *      -> Availability { carId, occupied: Period[] }  (blocked windows)
 *
 * The price preview lives on the bookings surface (`POST /bookings/quote`,
 * `modules/bookings`) — clients NEVER compute money.
 */
class CarsService {
  /** Published inventory of a city, with no availability/date parameters. */
  async catalog(
    city: string,
    filters: CarSearchFilters,
  ): Promise<Paginated<Car>> {
    const res = await Api.get<unknown>("/cars/catalog", {
      params: carCatalogParams(city, filters),
    });
    return carPageWireSchema.parse(res.data);
  }

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
  async search(
    city: string,
    filters: CarSearchFilters,
  ): Promise<Paginated<Car>> {
    const res = await Api.get<unknown>("/cars/search", {
      params: carSearchParams(city, filters),
    });
    return carPageWireSchema.parse(res.data);
  }

  async findById(carId: string): Promise<CarDetail> {
    const res = await Api.get<unknown>(`/cars/${encodeURIComponent(carId)}`);
    return carDetailWireSchema.parse(res.data);
  }

  /**
   * Occupied windows in `[from, to)` — the calendar blocks these ranges.
   * Availability reflects the server; the client never decides it.
   */
  async availability(
    carId: string,
    from: string,
    to: string,
  ): Promise<Availability> {
    const res = await Api.get<unknown>(
      `/cars/${encodeURIComponent(carId)}/availability`,
      { params: { from, to } },
    );
    return availabilityWireSchema.parse(res.data);
  }
}

export const carsService = new CarsService();
