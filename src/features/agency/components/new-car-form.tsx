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
  type CreateCarInput,
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
  type AgencyCar,
} from "@/shared/types/domain";
import { getErrorMessage } from "@/shared/api/errors";
import { centsToWholeUnitsInput, wholeUnitsToCents } from "@/shared/utils/money";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Numeric fields are kept as validated strings in the form and converted
 * once on submit — keeps react-hook-form + zod typing simple and the
 * error messages friendly. Money is typed in whole units and converted to
 * cents at this input boundary (never computed).
 */
const carSchema = z.object({
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
    .regex(AMOUNT_REGEX, "Enter the per-day price, e.g. 45 or 45.50"),
  /** Empty = the platform default deposit applies (`depositCents: null`). */
  deposit: z.union([
    z.literal(""),
    z.string().regex(AMOUNT_REGEX, "Enter the deposit, e.g. 200 or 200.00"),
  ]),
});
type CarFormValues = z.infer<typeof carSchema>;

function defaultsFor(
  car: AgencyCar | undefined,
  fixedBranchId: string | undefined,
): CarFormValues {
  return {
    branchId: car?.branchId ?? fixedBranchId ?? "",
    makeId: car?.makeId ?? "",
    modelId: car?.modelId ?? "",
    year: car ? String(car.year) : "",
    color: car?.color ?? "white",
    transmission: car?.transmission ?? "automatic",
    fuel: car?.fuel ?? "gasoline",
    seats: car ? String(car.seats) : "5",
    category: car?.category ?? "sedan",
    plate: car?.plate ?? "",
    pricePerDay: car ? centsToWholeUnitsInput(car.pricePerDayCents) : "",
    deposit:
      car && car.depositCents !== null
        ? centsToWholeUnitsInput(car.depositCents)
        : "",
  };
}

/** Form → wire fields shared by create and edit (branch/photos handled apart). */
function toCarFields(
  values: CarFormValues,
): Omit<CreateCarInput, "branchId" | "photos" | "depositCents"> {
  return {
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
  };
}

type CarFormProps =
  | {
      mode: "create";
      /** Hide the branch picker and list the car at this branch (single-branch hosts). */
      fixedBranchId?: string;
      /** Called instead of navigating away once the car (and its photos) exist. */
      onCreated?: (car: AgencyCar) => void;
      submitLabel?: string;
    }
  | {
      mode: "edit";
      car: AgencyCar;
      onSaved?: (car: AgencyCar) => void;
      onCancel?: () => void;
    };

/**
 * Catalog-driven car form. `create` posts the car as a draft and uploads
 * the picked photos right after; `edit` patches the listing fields (photos
 * and status are managed on the car page). One component for both modes so
 * the field rules never drift.
 */
export function CarForm(props: CarFormProps) {
  const router = useRouter();
  const qc = useQueryClient();
  const editing = props.mode === "edit";
  const car = editing ? props.car : undefined;
  const fixedBranchId = !editing ? props.fixedBranchId : undefined;

  const form = useForm<CarFormValues>({
    resolver: zodResolver(carSchema),
    defaultValues: defaultsFor(car, fixedBranchId),
  });

  const branchesQuery = useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: AgencyApi.branches,
    enabled: !editing && !fixedBranchId,
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

  // ── Photos (create only): picked before submit, uploaded right after ──────
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

  const create = useMutation({
    mutationFn: async (values: CarFormValues) => {
      const created = await AgencyApi.createCar({
        branchId: values.branchId,
        ...toCarFields(values),
        ...(values.deposit !== ""
          ? { depositCents: wholeUnitsToCents(Number(values.deposit)) }
          : {}),
      });

      // The car exists — now upload its photos one by one (per-file errors
      // never lose the car; a failure just leaves the gallery incomplete).
      let uploaded = 0;
      if (photoFiles.length > 0) {
        uploaded = await uploadCarPhotosSequentially(
          created.id,
          photoFiles,
          (u) =>
            setUploadStatus(
              `Uploading photo ${u.index + 1} of ${photoFiles.length}… ${u.percent}%`,
            ),
        );
        setUploadStatus(null);
      }
      return { car: created, uploaded };
    },
    onSuccess: ({ car: created, uploaded }) => {
      qc.invalidateQueries({ queryKey: agencyKeys.all });
      if (props.mode === "create" && props.onCreated) {
        props.onCreated(created);
        return;
      }
      // Some photos failed → land on the manage-photos surface to retry;
      // otherwise back to the fleet list.
      if (uploaded < photoFiles.length) {
        router.push(`/agency/fleet/${created.id}/photos`);
      } else {
        router.push("/agency/fleet");
      }
    },
  });

  const update = useMutation({
    mutationFn: (values: CarFormValues) =>
      AgencyApi.updateCar(car!.id, {
        ...toCarFields(values),
        // An emptied deposit CLEARS the override (`null` = platform default).
        depositCents:
          values.deposit === ""
            ? null
            : wholeUnitsToCents(Number(values.deposit)),
      }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() });
      form.reset(defaultsFor(saved, undefined));
      if (props.mode === "edit") props.onSaved?.(saved);
    },
  });

  const mutation = editing ? update : create;
  const errors = form.formState.errors;
  const showBranch = !editing && !fixedBranchId;

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      {showBranch ? (
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
            <p className="text-sm text-destructive">{errors.branchId.message}</p>
          ) : null}
        </div>
      ) : null}

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
            <p className="text-sm text-destructive">{errors.makeId.message}</p>
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
            <p className="text-sm text-destructive">{errors.modelId.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="car-year">Year</Label>
          <Input id="car-year" inputMode="numeric" placeholder="2024" {...form.register("year")} />
          {errors.year ? (
            <p className="text-sm text-destructive">{errors.year.message}</p>
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
            <p className="text-sm text-destructive">{errors.seats.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="car-plate">Plate (private)</Label>
          <Input id="car-plate" placeholder="A123456" {...form.register("plate")} />
          {errors.plate ? (
            <p className="text-sm text-destructive">{errors.plate.message}</p>
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
            <p className="text-sm text-destructive">{errors.pricePerDay.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="car-deposit">Security deposit (optional)</Label>
          <Input
            id="car-deposit"
            inputMode="decimal"
            placeholder="Platform default"
            aria-invalid={!!errors.deposit}
            {...form.register("deposit")}
          />
          {errors.deposit ? (
            <p className="text-sm text-destructive">{errors.deposit.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Held on the renter&apos;s card at check-in and released after the
              return. Leave empty to use the platform default.
            </p>
          )}
        </div>
      </div>

      {!editing ? (
        /* Photos — picked here, uploaded right after the car is created. */
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
            <ul className="space-y-0.5 text-sm text-destructive">
              {photoErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {uploadStatus ? (
        <p className="text-sm text-muted-foreground" role="status">
          {uploadStatus}
        </p>
      ) : null}

      {mutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {getErrorMessage(mutation.error, "Could not save the car.")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={mutation.isPending || (editing && !form.formState.isDirty)}
        >
          {mutation.isPending
            ? uploadStatus
              ? "Uploading photos…"
              : "Saving…"
            : editing
              ? "Save changes"
              : (props.submitLabel ?? "Save as draft")}
        </Button>
        {editing ? (
          props.onCancel ? (
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={props.onCancel}
            >
              Cancel
            </Button>
          ) : null
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/agency/fleet")}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** `/agency/fleet/new` — the plain create flow (navigates back to the fleet). */
export function NewCarForm() {
  return <CarForm mode="create" />;
}
