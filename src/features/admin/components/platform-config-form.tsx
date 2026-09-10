"use client";

import { useId, useState } from "react";
import { useForm, type FieldPath, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AdminApi,
  adminKeys,
  type UpdatePlatformConfigInput,
} from "@/features/admin/api";
import { legalKeys } from "@/features/legal/api";
import { getErrorMessage } from "@/shared/api/errors";
import type { PlatformConfigDto } from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { centsToWholeUnitsInput, wholeUnitsToCents } from "@/shared/utils/money";

/**
 * Bounds mirrored from spec §0.7 (`platform_config` keys). Numeric fields
 * are edited as strings and converted once at submit; the deposit is typed
 * in whole USD and converted to cents at the input boundary (never money
 * math — a unit conversion of a value a human entered).
 */
const BOUNDS = {
  commissionPct: { min: 0, max: 100 },
  freeCancellationHours: { min: 0, max: 720 },
  lateCancellationRetentionPct: { min: 0, max: 100 },
  earlyReturnPenaltyDays: { min: 0, max: 7 },
  disputeWindowHours: { min: 0, max: 168 },
  claimResponseHours: { min: 12, max: 168 },
  defaultDepositCents: { min: 0, max: 500_000 },
  checkinAdvancePct: { min: 0, max: 80 },
  depositReauthLeadHours: { min: 6, max: 72 },
  inspectionMinPhotos: { min: 0, max: 30 },
  inspectionMediaRetentionMonths: { min: 3, max: 60 },
} as const;

function intField(min: number, max: number) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((v) => Number(v) >= min && Number(v) <= max, {
      message: `Between ${min} and ${max}`,
    });
}

const configSchema = z.object({
  commissionPct: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter a percentage (up to 2 decimals)")
    .refine(
      (v) =>
        Number(v) >= BOUNDS.commissionPct.min &&
        Number(v) <= BOUNDS.commissionPct.max,
      { message: "Between 0 and 100" },
    ),
  freeCancellationHours: intField(
    BOUNDS.freeCancellationHours.min,
    BOUNDS.freeCancellationHours.max,
  ),
  lateCancellationRetentionPct: intField(
    BOUNDS.lateCancellationRetentionPct.min,
    BOUNDS.lateCancellationRetentionPct.max,
  ),
  earlyReturnPenaltyDays: intField(
    BOUNDS.earlyReturnPenaltyDays.min,
    BOUNDS.earlyReturnPenaltyDays.max,
  ),
  disputeWindowHours: intField(
    BOUNDS.disputeWindowHours.min,
    BOUNDS.disputeWindowHours.max,
  ),
  claimResponseHours: intField(
    BOUNDS.claimResponseHours.min,
    BOUNDS.claimResponseHours.max,
  ),
  /** Whole USD; converted to cents (0..500000) on submit. */
  defaultDeposit: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount (up to 2 decimals)")
    .refine(
      (v) =>
        wholeUnitsToCents(Number(v)) >= BOUNDS.defaultDepositCents.min &&
        wholeUnitsToCents(Number(v)) <= BOUNDS.defaultDepositCents.max,
      { message: "Between 0 and 5,000" },
    ),
  checkinAdvancePct: intField(
    BOUNDS.checkinAdvancePct.min,
    BOUNDS.checkinAdvancePct.max,
  ),
  depositReauthLeadHours: intField(
    BOUNDS.depositReauthLeadHours.min,
    BOUNDS.depositReauthLeadHours.max,
  ),
  inspectionsRequired: z.boolean(),
  inspectionMinPhotos: intField(
    BOUNDS.inspectionMinPhotos.min,
    BOUNDS.inspectionMinPhotos.max,
  ),
  inspectionMediaRetentionMonths: intField(
    BOUNDS.inspectionMediaRetentionMonths.min,
    BOUNDS.inspectionMediaRetentionMonths.max,
  ),
  stripePayoutsEnabled: z.boolean(),
});
type ConfigFormValues = z.infer<typeof configSchema>;

function configDefaults(c: PlatformConfigDto): ConfigFormValues {
  return {
    commissionPct: String(c.commissionPct),
    freeCancellationHours: String(c.freeCancellationHours),
    lateCancellationRetentionPct: String(c.lateCancellationRetentionPct),
    earlyReturnPenaltyDays: String(c.earlyReturnPenaltyDays),
    disputeWindowHours: String(c.disputeWindowHours),
    claimResponseHours: String(c.claimResponseHours),
    defaultDeposit: centsToWholeUnitsInput(c.defaultDepositCents),
    checkinAdvancePct: String(c.checkinAdvancePct),
    depositReauthLeadHours: String(c.depositReauthLeadHours),
    inspectionsRequired: c.inspectionsRequired,
    inspectionMinPhotos: String(c.inspectionMinPhotos),
    inspectionMediaRetentionMonths: String(c.inspectionMediaRetentionMonths),
    stripePayoutsEnabled: c.stripePayoutsEnabled,
  };
}

/** Form values → the wire DTO (numbers + cents). */
function toConfig(values: ConfigFormValues): PlatformConfigDto {
  return {
    commissionPct: Number(values.commissionPct),
    freeCancellationHours: Number(values.freeCancellationHours),
    lateCancellationRetentionPct: Number(values.lateCancellationRetentionPct),
    earlyReturnPenaltyDays: Number(values.earlyReturnPenaltyDays),
    disputeWindowHours: Number(values.disputeWindowHours),
    claimResponseHours: Number(values.claimResponseHours),
    defaultDepositCents: wholeUnitsToCents(Number(values.defaultDeposit)),
    checkinAdvancePct: Number(values.checkinAdvancePct),
    depositReauthLeadHours: Number(values.depositReauthLeadHours),
    inspectionsRequired: values.inspectionsRequired,
    inspectionMinPhotos: Number(values.inspectionMinPhotos),
    inspectionMediaRetentionMonths: Number(values.inspectionMediaRetentionMonths),
    stripePayoutsEnabled: values.stripePayoutsEnabled,
  };
}

const CONFIG_KEYS = Object.keys(BOUNDS).concat(
  "inspectionsRequired",
  "stripePayoutsEnabled",
) as (keyof PlatformConfigDto)[];

/** Only the keys whose value differs from the loaded config travel in the PATCH. */
function diffConfig(
  current: PlatformConfigDto,
  next: PlatformConfigDto,
): UpdatePlatformConfigInput {
  const patch: UpdatePlatformConfigInput = {};
  for (const key of CONFIG_KEYS) {
    if (current[key] !== next[key]) {
      Object.assign(patch, { [key]: next[key] });
    }
  }
  return patch;
}

/**
 * The whole platform configuration (spec §0.7) as ONE form: commission,
 * cancellation tiers, dispute/claim windows, deposit defaults, check-in
 * rules, media limits and the Stripe payout switch. Saved with a partial
 * `PATCH /admin/config` carrying only the changed keys; the form re-seeds
 * from the server response so what you see is what was stored.
 */
export function PlatformConfigForm({ config }: { config: PlatformConfigDto }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: configDefaults(config),
  });

  const mutation = useMutation({
    mutationFn: (input: UpdatePlatformConfigInput) =>
      AdminApi.updateConfig(input),
    onSuccess: (next) => {
      qc.setQueryData(adminKeys.config(), next);
      // The cancellation policy is published to customers via /legal/current.
      qc.invalidateQueries({ queryKey: legalKeys.all });
      form.reset(configDefaults(next));
      setSaved(true);
    },
  });

  function submit(values: ConfigFormValues) {
    setSaved(false);
    const patch = diffConfig(config, toConfig(values));
    if (Object.keys(patch).length === 0) {
      form.reset(configDefaults(config));
      return;
    }
    mutation.mutate(patch);
  }

  const dirty = form.formState.isDirty;
  const busy = mutation.isPending;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(submit)}
      className="space-y-6"
      onChange={() => setSaved(false)}
    >
      <Section
        title="Commission"
        description="Applied to each booking's subtotal and frozen into its pricing snapshot at request time. Editing it never changes existing bookings."
      >
        <NumberField
          form={form}
          name="commissionPct"
          label="Commission"
          unit="%"
          hint="0 – 100, up to two decimals."
        />
      </Section>

      <Section
        title="Cancellation policy"
        description="Published to customers through the legal pages and applied by the settlement engine. Figures are snapshotted into each settlement when it is computed."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            form={form}
            name="freeCancellationHours"
            label="Free cancellation"
            unit="h before pickup"
            hint="0 – 720."
          />
          <NumberField
            form={form}
            name="lateCancellationRetentionPct"
            label="Late cancellation retention"
            unit="% of subtotal"
            hint="Credited to the host. 0 – 100."
          />
          <NumberField
            form={form}
            name="earlyReturnPenaltyDays"
            label="Early return penalty"
            unit="days"
            hint="Unused days not refunded. 0 – 7."
          />
        </div>
      </Section>

      <Section
        title="Disputes and claims"
        description="After a return, the host may file a damage claim during the dispute window; the customer then has the response window before an admin decides."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            form={form}
            name="disputeWindowHours"
            label="Dispute window"
            unit="h after return"
            hint="Settlement waits for it. 0 – 168."
          />
          <NumberField
            form={form}
            name="claimResponseHours"
            label="Customer response window"
            unit="h"
            hint="12 – 168."
          />
        </div>
      </Section>

      <Section
        title="Security deposit"
        description="Held on the customer's card at check-in (cars may override the default) and captured only through an approved claim."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            form={form}
            name="defaultDeposit"
            label="Default deposit"
            unit="USD"
            hint="Used when a car has no deposit of its own. 0 – 5,000."
            decimal
          />
          <NumberField
            form={form}
            name="depositReauthLeadHours"
            label="Re-authorize before expiry"
            unit="h"
            hint="Lead time for renewing long holds. 6 – 72."
          />
        </div>
      </Section>

      <Section
        title="Check-in, inspections and media"
        description="Inspections gate the pickup and return transitions for card-paid bookings. Media are kept for the retention period, then garbage-collected."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            form={form}
            name="checkinAdvancePct"
            label="Advance at check-in"
            unit="% of subtotal"
            hint="Paid to Stripe-enabled hosts once check-in is confirmed. 0 – 80."
          />
          <NumberField
            form={form}
            name="inspectionMinPhotos"
            label="Minimum photos"
            unit="per inspection"
            hint="0 – 30."
          />
          <NumberField
            form={form}
            name="inspectionMediaRetentionMonths"
            label="Media retention"
            unit="months"
            hint="3 – 60."
          />
        </div>
        <CheckboxField
          form={form}
          name="inspectionsRequired"
          label="Require a finalized inspection before pickup and return"
          hint="When off, hosts can mark pickups and returns without the guided inspection (walk-ins are never gated)."
        />
      </Section>

      <Section
        title="Payouts"
        description="Automatic Stripe payouts to hosts' bank accounts at settlement. Keep this off until Stripe has granted cross-border payout access; manual bank transfers keep working either way."
      >
        <CheckboxField
          form={form}
          name="stripePayoutsEnabled"
          label="Enable Stripe payouts"
          hint="Hosts can set up their payout account and settlements are paid out automatically."
        />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!dirty || busy}>
          {busy ? "Saving…" : "Save configuration"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!dirty || busy}
          onClick={() => {
            form.reset(configDefaults(config));
            setSaved(false);
          }}
        >
          Discard changes
        </Button>
        {mutation.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {getErrorMessage(mutation.error, "Could not save the configuration.")}
          </p>
        ) : saved && !dirty ? (
          <p className="text-sm text-success">Configuration saved.</p>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

type NumericName = Exclude<
  FieldPath<ConfigFormValues>,
  "inspectionsRequired" | "stripePayoutsEnabled"
>;

function NumberField({
  form,
  name,
  label,
  unit,
  hint,
  decimal = false,
}: {
  form: UseFormReturn<ConfigFormValues>;
  name: NumericName;
  label: string;
  unit: string;
  hint: string;
  decimal?: boolean;
}) {
  const id = useId();
  const error = form.formState.errors[name]?.message;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode={decimal ? "decimal" : "numeric"}
          className="max-w-[140px]"
          aria-invalid={!!error}
          {...form.register(name)}
        />
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function CheckboxField({
  form,
  name,
  label,
  hint,
}: {
  form: UseFormReturn<ConfigFormValues>;
  name: "inspectionsRequired" | "stripePayoutsEnabled";
  label: string;
  hint: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-border p-3 text-sm"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        {...form.register(name)}
      />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
