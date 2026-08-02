"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  FUEL_TYPES,
  TRANSMISSIONS,
} from "@/shared/types/domain";
import { wholeUnitsToCents } from "@/shared/utils/money";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * Numeric fields are kept as validated strings in the form and converted
 * once on submit — keeps react-hook-form + zod typing simple and the
 * error messages friendly.
 */
const newCarSchema = z.object({
  branchId: z.string().min(1, "Pick a branch"),
  makeId: z.string().min(1, "Pick a make"),
  modelId: z.string().min(1, "Pick a model"),
  year: z
    .string()
    .regex(/^(19|20)\d{2}$/, "Enter a 4-digit year"),
  color: z.enum(CAR_COLORS),
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUEL_TYPES),
  seats: z.string().regex(/^\d{1,2}$/, "Enter the number of seats"),
  category: z.enum(CAR_CATEGORIES),
  plate: z.string().min(3, "Enter the plate (kept private)"),
  pricePerDay: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter the per-day price, e.g. 45 or 45.50"),
});
type NewCarFormValues = z.infer<typeof newCarSchema>;

export function NewCarForm() {
  const router = useRouter();
  const qc = useQueryClient();

  const form = useForm<NewCarFormValues>({
    resolver: zodResolver(newCarSchema),
    defaultValues: {
      branchId: "",
      makeId: "",
      modelId: "",
      year: "",
      color: "white",
      transmission: "automatic",
      fuel: "gasoline",
      seats: "5",
      category: "sedan",
      plate: "",
      pricePerDay: "",
    },
  });

  const branchesQuery = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
  });

  const makesQuery = useQuery({
    queryKey: catalogKeys.makes(),
    queryFn: CatalogApi.listMakes,
  });

  // Dependent select: models load only after a make is chosen.
  const makeId = form.watch("makeId");
  const modelsQuery = useQuery({
    queryKey: catalogKeys.models(makeId),
    queryFn: () => CatalogApi.listModels(makeId),
    enabled: !!makeId,
  });

  const mutation = useMutation({
    mutationFn: (values: NewCarFormValues) =>
      AgencyApi.createCar({
        branchId: values.branchId,
        makeId: values.makeId,
        modelId: values.modelId,
        year: Number(values.year),
        color: values.color,
        transmission: values.transmission,
        fuel: values.fuel,
        seats: Number(values.seats),
        category: values.category,
        plate: values.plate,
        // Unit conversion at the input boundary (agency-entered price).
        pricePerDayCents: wholeUnitsToCents(Number(values.pricePerDay)),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.all });
      router.push("/agency/fleet");
    },
  });

  const errors = form.formState.errors;

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor="car-branch">Branch</Label>
        <Select
          id="car-branch"
          disabled={branchesQuery.isLoading || branchesQuery.isError}
          {...form.register("branchId")}
        >
          <option value="">
            {branchesQuery.isError
              ? "Branches unavailable"
              : "Select a branch"}
          </option>
          {(branchesQuery.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {errors.branchId ? (
          <p className="text-sm text-red-600">{errors.branchId.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="car-make">Make</Label>
          <Select
            id="car-make"
            disabled={makesQuery.isLoading || makesQuery.isError}
            {...form.register("makeId", {
              onChange: () => form.setValue("modelId", ""),
            })}
          >
            <option value="">
              {makesQuery.isError ? "Catalog unavailable" : "Select a make"}
            </option>
            {(makesQuery.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          {errors.makeId ? (
            <p className="text-sm text-red-600">{errors.makeId.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-model">Model</Label>
          <Select
            id="car-model"
            disabled={!makeId || modelsQuery.isLoading}
            {...form.register("modelId")}
          >
            <option value="">
              {makeId ? "Select a model" : "Pick a make first"}
            </option>
            {(modelsQuery.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          {errors.modelId ? (
            <p className="text-sm text-red-600">{errors.modelId.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="car-year">Year</Label>
          <Input id="car-year" inputMode="numeric" placeholder="2024" {...form.register("year")} />
          {errors.year ? (
            <p className="text-sm text-red-600">{errors.year.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-color">Color</Label>
          <Select id="car-color" {...form.register("color")}>
            {CAR_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-category">Category</Label>
          <Select id="car-category" {...form.register("category")}>
            {CAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="car-transmission">Transmission</Label>
          <Select id="car-transmission" {...form.register("transmission")}>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-fuel">Fuel</Label>
          <Select id="car-fuel" {...form.register("fuel")}>
            {FUEL_TYPES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-seats">Seats</Label>
          <Input id="car-seats" inputMode="numeric" {...form.register("seats")} />
          {errors.seats ? (
            <p className="text-sm text-red-600">{errors.seats.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="car-plate">Plate (private)</Label>
          <Input id="car-plate" placeholder="A123456" {...form.register("plate")} />
          {errors.plate ? (
            <p className="text-sm text-red-600">{errors.plate.message}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Never shown to customers.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-price">Price per day</Label>
          <Input
            id="car-price"
            inputMode="decimal"
            placeholder="45.00"
            {...form.register("pricePerDay")}
          />
          {errors.pricePerDay ? (
            <p className="text-sm text-red-600">{errors.pricePerDay.message}</p>
          ) : null}
        </div>
      </div>

      {/* Photo upload placeholder — media pipeline lands later. */}
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Photo upload placeholder — the media pipeline lands in a later
        iteration. Cars can be saved as drafts without photos.
      </div>

      {mutation.isError ? (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save as draft"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/agency/fleet")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
