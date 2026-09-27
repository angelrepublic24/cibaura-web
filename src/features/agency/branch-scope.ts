import type { AgencyCar, OccupancyEntry } from "@/shared/types/domain";
import type { BranchScope } from "./rbac";

/** Presentation defense only; the API must enforce the same scope. Unknown = closed. */
export function fleetForScope(
  cars: AgencyCar[],
  scope: BranchScope | undefined,
): AgencyCar[] {
  if (scope?.mode === "all") return cars;
  if (scope?.mode !== "branches") return [];
  const allowed = new Set(scope.branchIds);
  return cars.filter(
    (car) => Boolean(car.branchId) && allowed.has(car.branchId),
  );
}

export function occupancyForScope(
  entries: OccupancyEntry[],
  cars: AgencyCar[],
  scope: BranchScope | undefined,
): OccupancyEntry[] {
  if (scope?.mode === "all") return entries;
  const allowedCars = new Set(fleetForScope(cars, scope).map((car) => car.id));
  return entries.filter((entry) => allowedCars.has(entry.carId));
}
