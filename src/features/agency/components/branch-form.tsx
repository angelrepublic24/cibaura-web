"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AgencyApi,
  agencyKeys,
  type CreateBranchInput,
} from "@/features/agency/api";
import { PHONE_MESSAGE, PHONE_REGEX } from "@/features/auth/schemas";
import { CatalogApi, catalogKeys } from "@/features/catalog/api";
import type { Branch } from "@/shared/types/domain";
import {
  API_ERROR_CODES,
  getErrorMessage,
  isApiErrorCode,
} from "@/shared/api/errors";
import { centsToWholeUnitsInput, wholeUnitsToCents } from "@/shared/utils/money";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

// ── opening hours ─────────────────────────────────────────────────────────────

/** Wire keys of `BranchDto.hours` (`{ mon: "08:00-18:00", … }`). */
export const WEEK_DAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export const WEEK_DAY_LABELS: Record<WeekDay, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOURS_RANGE_REGEX = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

const daySchema = z
  .object({
    open: z.boolean(),
    from: z.string(),
    to: z.string(),
  })
  .refine(
    (d) =>
      !d.open ||
      (TIME_REGEX.test(d.from) && TIME_REGEX.test(d.to) && d.from < d.to),
    { message: "Set an opening time before the closing time", path: ["from"] },
  );

const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;

/** Mirrors the backend `CreateBranchDto` bounds; money typed in whole units. */
const branchSchema = z
  .object({
    cityId: z.string().min(1, "Pick a city"),
    name: z
      .string()
      .trim()
      .min(2, "Enter the branch name")
      .max(160, "At most 160 characters"),
    address: z
      .string()
      .trim()
      .min(5, "Enter the street address")
      .max(300, "At most 300 characters"),
    phone: z.union([z.literal(""), z.string().regex(PHONE_REGEX, PHONE_MESSAGE)]),
    hours: z.object({
      mon: daySchema,
      tue: daySchema,
      wed: daySchema,
      thu: daySchema,
      fri: daySchema,
      sat: daySchema,
      sun: daySchema,
    }),
    deliveryEnabled: z.boolean(),
    /** Delivery origin — set by the address picker, kept across edits. */
    lat: z.number().nullable(),
    lng: z.number().nullable(),
    deliveryBaseFee: z.string().trim(),
    deliveryPerKm: z.string().trim(),
    deliveryMaxKm: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (!v.deliveryEnabled) return;
    if (v.lat === null || v.lng === null) {
      ctx.addIssue({
        code: "custom",
        path: ["lat"],
        message: "Pick the branch location on the map search",
      });
    }
    if (!AMOUNT_REGEX.test(v.deliveryBaseFee)) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryBaseFee"],
        message: "Enter the base fee, e.g. 200",
      });
    }
    if (!AMOUNT_REGEX.test(v.deliveryPerKm)) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryPerKm"],
        message: "Enter the per-km fee, e.g. 50",
      });
    }
    if (v.deliveryMaxKm !== "" && !/^[1-9]\d*$/.test(v.deliveryMaxKm)) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryMaxKm"],
        message: "Whole kilometres, at least 1",
      });
    }
  });
type BranchFormValues = z.infer<typeof branchSchema>;
type DayValues = BranchFormValues["hours"][WeekDay];

function parseDay(range: string | undefined): DayValues {
  if (!range || !HOURS_RANGE_REGEX.test(range)) {
    return { open: false, from: "09:00", to: "18:00" };
  }
  const [from, to] = range.split("-");
  if (from === undefined || to === undefined) {
    return { open: false, from: "09:00", to: "18:00" };
  }
  return { open: true, from, to };
}

function toHoursMap(hours: BranchFormValues["hours"]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const day of WEEK_DAYS) {
    const d = hours[day];
    if (d.open) map[day] = `${d.from}-${d.to}`;
  }
  return map;
}

function defaultsFor(branch: Branch | undefined): BranchFormValues {
  return {
    cityId: branch?.cityId ?? "",
    name: branch?.name ?? "",
    address: branch?.address ?? "",
    phone: branch?.phone ?? "",
    hours: {
      mon: parseDay(branch?.hours?.mon),
      tue: parseDay(branch?.hours?.tue),
      wed: parseDay(branch?.hours?.wed),
      thu: parseDay(branch?.hours?.thu),
      fri: parseDay(branch?.hours?.fri),
      sat: parseDay(branch?.hours?.sat),
      sun: parseDay(branch?.hours?.sun),
    },
    deliveryEnabled: branch?.deliveryEnabled ?? false,
    lat: branch?.lat ?? null,
    lng: branch?.lng ?? null,
    deliveryBaseFee: branch ? centsToWholeUnitsInput(branch.deliveryBaseFeeCents) : "",
    deliveryPerKm: branch ? centsToWholeUnitsInput(branch.deliveryPerKmCents) : "",
    deliveryMaxKm: branch?.deliveryMaxKm ? String(branch.deliveryMaxKm) : "",
  };
}

/**
 * Form → wire. A blank phone is OMITTED on create (nothing to clear) and
 * sent as `null` on edit so the stored number is actually removed — a
 * PATCH that omits the field leaves it untouched.
 */
function toPayload(
  values: BranchFormValues,
  mode: BranchFormProps["mode"],
): CreateBranchInput {
  const delivery = values.deliveryEnabled;
  return {
    cityId: values.cityId,
    name: values.name,
    address: values.address,
    phone: values.phone || (mode === "edit" ? null : undefined),
    hours: toHoursMap(values.hours),
    deliveryEnabled: delivery,
    ...(delivery && values.lat !== null && values.lng !== null
      ? {
          lat: values.lat,
          lng: values.lng,
          deliveryBaseFeeCents: wholeUnitsToCents(Number(values.deliveryBaseFee)),
          deliveryPerKmCents: wholeUnitsToCents(Number(values.deliveryPerKm)),
          ...(values.deliveryMaxKm
            ? { deliveryMaxKm: Number(values.deliveryMaxKm) }
            : {}),
        }
      : {}),
  };
}

type BranchFormProps =
  | { mode: "create"; onDone: () => void }
  | { mode: "edit"; branch: Branch; onDone: () => void };

/**
 * Create / edit form for a branch: identity (city, name, address, phone),
 * weekly opening hours and the door-to-door delivery config (origin pin +
 * fee parameters). One component for both modes so the two never drift; on
 * edit the delivery origin is kept unless a new address is picked.
 */
export function BranchForm(props: BranchFormProps) {
  const qc = useQueryClient();
  const editing = props.mode === "edit";
  const branch = editing ? props.branch : undefined;

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: defaultsFor(branch),
  });
  const errors = form.formState.errors;

  const citiesQuery = useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: CatalogApi.listCities,
  });

  const mutation = useMutation({
    mutationFn: (values: BranchFormValues) =>
      editing
        ? AgencyApi.updateBranch(props.branch.id, toPayload(values, "edit"))
        : AgencyApi.createBranch(toPayload(values, "create")),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: agencyKeys.branches() });
      props.onDone();
    },
  });

  const deliveryEnabled = form.watch("deliveryEnabled");
  const lat = form.watch("lat");
  const hasLocation = lat !== null;

  function pickLocation(addr: PickedAddress) {
    form.setValue("lat", addr.lat, { shouldValidate: true, shouldDirty: true });
    form.setValue("lng", addr.lng, { shouldValidate: true, shouldDirty: true });
  }

  const idp = editing ? `br-${props.branch.id}` : "br-new";

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">
          {editing ? `Edit ${props.branch.name}` : "New branch"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idp}-city`}>City</Label>
              <Select
                id={`${idp}-city`}
                disabled={citiesQuery.isLoading || citiesQuery.isError}
                aria-invalid={!!errors.cityId}
                {...form.register("cityId")}
              >
                <option value="">
                  {citiesQuery.isError ? "Cities unavailable" : "Select a city"}
                </option>
                {(citiesQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {errors.cityId ? (
                <p className="text-sm text-destructive">{errors.cityId.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idp}-name`}>Branch name</Label>
              <Input
                id={`${idp}-name`}
                placeholder="Main office"
                maxLength={160}
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              {errors.name ? (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`${idp}-address`}>Address</Label>
              <Input
                id={`${idp}-address`}
                placeholder="Av. 27 de Febrero 123"
                maxLength={300}
                aria-invalid={!!errors.address}
                {...form.register("address")}
              />
              {errors.address ? (
                <p className="text-sm text-destructive">
                  {errors.address.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idp}-phone`}>Phone (optional)</Label>
              <Input
                id={`${idp}-phone`}
                type="tel"
                placeholder="+1 809 555 0100"
                aria-invalid={!!errors.phone}
                {...form.register("phone")}
              />
              {errors.phone ? (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              ) : null}
            </div>
          </div>

          {/* ── Opening hours ─────────────────────────────────────────── */}
          <fieldset className="mt-4 rounded-[var(--radius-sm)] border border-border p-3.5">
            <legend className="px-1 text-sm font-medium">Opening hours</legend>
            <p className="mb-3 text-xs text-muted-foreground">
              Shown to customers once their booking is confirmed. Leave a day
              unchecked when the branch is closed.
            </p>
            <div className="space-y-2">
              {WEEK_DAYS.map((day) => {
                const open = form.watch(`hours.${day}.open`);
                const dayError = errors.hours?.[day]?.from?.message;
                return (
                  <div
                    key={day}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2 text-sm"
                  >
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        {...form.register(`hours.${day}.open`)}
                      />
                      {WEEK_DAY_LABELS[day]}
                    </label>
                    <Input
                      type="time"
                      className="h-9 w-28"
                      aria-label={`${WEEK_DAY_LABELS[day]} opens at`}
                      disabled={!open}
                      aria-invalid={!!dayError}
                      {...form.register(`hours.${day}.from`)}
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      className="h-9 w-28"
                      aria-label={`${WEEK_DAY_LABELS[day]} closes at`}
                      disabled={!open}
                      aria-invalid={!!dayError}
                      {...form.register(`hours.${day}.to`)}
                    />
                    {dayError ? (
                      <p className="col-span-4 text-sm text-destructive">
                        {WEEK_DAY_LABELS[day]}: {dayError}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* ── Door-to-door delivery ─────────────────────────────────── */}
          <div className="mt-4 rounded-[var(--radius-sm)] border border-border p-3.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                {...form.register("deliveryEnabled")}
              />
              Offer door-to-door delivery from this branch
            </label>
            {deliveryEnabled ? (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${idp}-loc`}>
                    Branch location (sets the delivery origin)
                  </Label>
                  <AddressAutocomplete
                    id={`${idp}-loc`}
                    placeholder={
                      hasLocation
                        ? "Location set — search to change it"
                        : "Search the branch's location…"
                    }
                    onSelect={pickLocation}
                  />
                  {errors.lat ? (
                    <p className="text-sm text-destructive">{errors.lat.message}</p>
                  ) : hasLocation ? (
                    <p className="text-xs text-success">Location on file.</p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idp}-base`}>Base fee</Label>
                    <Input
                      id={`${idp}-base`}
                      inputMode="decimal"
                      placeholder="200"
                      aria-invalid={!!errors.deliveryBaseFee}
                      {...form.register("deliveryBaseFee")}
                    />
                    {errors.deliveryBaseFee ? (
                      <p className="text-sm text-destructive">
                        {errors.deliveryBaseFee.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idp}-perkm`}>Per km</Label>
                    <Input
                      id={`${idp}-perkm`}
                      inputMode="decimal"
                      placeholder="50"
                      aria-invalid={!!errors.deliveryPerKm}
                      {...form.register("deliveryPerKm")}
                    />
                    {errors.deliveryPerKm ? (
                      <p className="text-sm text-destructive">
                        {errors.deliveryPerKm.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${idp}-maxkm`}>Max km (optional)</Label>
                    <Input
                      id={`${idp}-maxkm`}
                      inputMode="numeric"
                      placeholder="30"
                      aria-invalid={!!errors.deliveryMaxKm}
                      {...form.register("deliveryMaxKm")}
                    />
                    {errors.deliveryMaxKm ? (
                      <p className="text-sm text-destructive">
                        {errors.deliveryMaxKm.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fee = base + per-km × distance from the branch to the
                  customer&apos;s address. Amounts are in whole units.
                </p>
              </div>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {isApiErrorCode(
                mutation.error,
                API_ERROR_CODES.INDIVIDUAL_SINGLE_BRANCH,
              )
                ? "Private hosts rent from a single address — edit your existing one instead of adding another."
                : getErrorMessage(mutation.error, "Could not save the branch.")}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Create branch"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={props.onDone}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
