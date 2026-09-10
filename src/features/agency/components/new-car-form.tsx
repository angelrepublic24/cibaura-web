"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import {
  AgencyApi,
  agencyKeys,
  MAX_PHOTOS_PER_CAR,
} from "@/features/agency/api";
import {
  uploadCarPhotosSequentially,
  validateCarPhotoFile,
} from "@/features/agency/car-photo-upload";
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

  // ── Photos: picked before submit, uploaded right after the car exists ──────
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Object-URL previews, revoked whenever the selection changes/unmounts.
  const previews = useMemo(
    () => photoFiles.map((f) => URL.createObjectURL(f)),
    [photoFiles],
  );
  useEffect(
    () => () => previews.forEach((url) => URL.revokeObjectURL(url)),
    [previews],
  );

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const errors: string[] = [];
    const accepted = Array.from(list).filter((f) => {
      const reason = validateCarPhotoFile(f);
      if (reason) errors.push(`${f.name}: ${reason}`);
      return !reason;
    });
    const merged = [...photoFiles, ...accepted];
    if (merged.length > MAX_PHOTOS_PER_CAR) {
      errors.push(`A car can have at most ${MAX_PHOTOS_PER_CAR} photos.`);
    }
    setPhotoErrors(errors);
    setPhotoFiles(merged.slice(0, MAX_PHOTOS_PER_CAR));
  }

  const mutation = useMutation({
    mutationFn: async (values: NewCarFormValues) => {
      const car = await AgencyApi.createCar({
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
      });

      // The car exists — now upload its photos one by one (per-file errors
      // never lose the car; a failure just leaves the gallery incomplete).
      let uploaded = 0;
      if (photoFiles.length > 0) {
        uploaded = await uploadCarPhotosSequentially(
          car.id,
          photoFiles,
          (u) =>
            setUploadStatus(
              `Uploading photo ${u.index + 1} of ${photoFiles.length}… ${u.percent}%`,
            ),
        );
        setUploadStatus(null);
      }
      return { car, uploaded };
    },
    onSuccess: ({ car, uploaded }) => {
      qc.invalidateQueries({ queryKey: agencyKeys.all });
      // Some photos failed → land on the manage-photos surface to retry;
      // otherwise back to the fleet list.
      if (uploaded < photoFiles.length) {
        router.push(`/agency/fleet/${car.id}/photos`);
      } else {
        router.push("/agency/fleet");
      }
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

      {/* Photos — picked here, uploaded right after the car is created. */}
      <div className="space-y-2">
        <Label>Photos</Label>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />

        {photoFiles.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photoFiles.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews[i]}
                  alt={file.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {i === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium">
                    Cover
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  className="absolute right-1 top-1 rounded-full bg-surface/90 p-1 shadow-sm hover:bg-surface"
                  disabled={mutation.isPending}
                  onClick={() =>
                    setPhotoFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={mutation.isPending || photoFiles.length >= MAX_PHOTOS_PER_CAR}
          className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
        >
          <ImagePlus className="h-5 w-5" />
          {photoFiles.length >= MAX_PHOTOS_PER_CAR
            ? `Maximum of ${MAX_PHOTOS_PER_CAR} photos selected`
            : "Add photos of this exact car — JPEG, PNG or WEBP, up to 5 MB each"}
        </button>
        <p className="text-xs text-muted-foreground">
          {photoFiles.length}/{MAX_PHOTOS_PER_CAR} selected · the first photo
          becomes the cover. You can also manage photos later from the fleet
          list. Cars can be saved as drafts without photos.
        </p>
        {photoErrors.length > 0 ? (
          <ul className="space-y-0.5 text-sm text-red-600">
            {photoErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {uploadStatus ? (
        <p className="text-sm text-muted-foreground" role="status">
          {uploadStatus}
        </p>
      ) : null}

      {mutation.isError ? (
        <p className="text-sm text-red-600">{mutation.error.message}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? uploadStatus
              ? "Uploading photos…"
              : "Saving…"
            : "Save as draft"}
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
