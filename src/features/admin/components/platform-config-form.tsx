"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { AdminApi, adminKeys } from "@/features/admin/api";
import {
  PLATFORM_CONFIG_LIMITS,
  TAX_BASES,
  configToFormValues,
  formValuesToPatch,
  platformConfigFormSchema,
  type PlatformConfig,
  type PlatformConfigFormValues,
  type PlatformConfigNumericField,
} from "@/features/admin/platform-config-contract";
import { legalKeys } from "@/features/legal/api";
import { getErrorMessage } from "@/shared/api/errors";
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
import { Select } from "@/shared/components/ui/select";

/**
 * The platform settings console: all fifteen settings, ONE save.
 *
 * It used to edit four of them through the two single-purpose routes that
 * predate `PATCH /admin/config`; the other eleven — the dispute window, the
 * early-return penalty, the late-cancellation retention, the check-in advance
 * among them — could only be changed with a psql session. One endpoint now
 * takes the whole set.
 *
 * ONE form, one submit, because the endpoint is atomic: the server
 * range-checks every supplied field before it writes any of them, so a
 * rejected value never leaves the rest half-applied. Only DIRTY fields are
 * sent, which is what keeps a field the console cannot express — a commission
 * booted from env with three decimals — from blocking the other fourteen.
 */

/** The fields backed by a text input (everything except the enum and the two flags). */
type TextField = Exclude<
  {
    [K in keyof PlatformConfigFormValues]: PlatformConfigFormValues[K] extends string
      ? K
      : never;
  }[keyof PlatformConfigFormValues],
  "taxBase"
>;

type FieldSpec = {
  name: TextField;
  label: string;
  hint: string;
  inputMode?: "numeric" | "decimal";
};

/** Hint bounds come from the limits table, so a bound can only be wrong once. */
function range(field: PlatformConfigNumericField): string {
  const { min, max } = PLATFORM_CONFIG_LIMITS[field];
  return `${min} – ${max}`;
}

const DEPOSIT_LIMITS = PLATFORM_CONFIG_LIMITS.defaultDepositCents;

const COMMISSION_FIELDS: FieldSpec[] = [
  {
    name: "commissionPct",
    label: "Commission (%)",
    hint: `${range("commissionPct")}, up to two decimals. Snapshotted onto each booking, so editing it never re-prices an existing one.`,
    inputMode: "decimal",
  },
];

const POLICY_FIELDS: FieldSpec[] = [
  {
    name: "freeCancellationHours",
    label: "Free cancellation (hours)",
    hint: `Hours before pickup. ${range("freeCancellationHours")}.`,
  },
  {
    name: "lateCancellationRetentionPct",
    label: "Late cancellation retention (%)",
    hint: `Share of the subtotal the agency keeps. ${range("lateCancellationRetentionPct")}.`,
  },
  {
    name: "earlyReturnPenaltyDays",
    label: "Early return penalty (days)",
    hint: `Unused days the agency keeps on an early return. ${range("earlyReturnPenaltyDays")}.`,
  },
];

const CLAIM_FIELDS: FieldSpec[] = [
  {
    name: "disputeWindowHours",
    label: "Dispute window (hours)",
    hint: `How long after the return the host may file a damage claim. ${range("disputeWindowHours")}.`,
  },
  {
    name: "claimResponseHours",
    label: "Claim response (hours)",
    hint: `How long the customer has to accept or reject a claim. ${range("claimResponseHours")}.`,
  },
];

const DEPOSIT_FIELDS: FieldSpec[] = [
  {
    name: "defaultDepositUnits",
    label: "Default security deposit",
    hint: `Used when a car has no override. ${DEPOSIT_LIMITS.min / 100} – ${DEPOSIT_LIMITS.max / 100}.`,
    inputMode: "decimal",
  },
  {
    name: "depositReauthLeadHours",
    label: "Deposit re-authorization lead (hours)",
    hint: `How early a held deposit is re-authorized before it expires. ${range("depositReauthLeadHours")}.`,
  },
];

const INSPECTION_FIELDS: FieldSpec[] = [
  {
    name: "inspectionMinPhotos",
    label: "Minimum photos",
    hint: `Photos an inspection needs before it can be submitted. ${range("inspectionMinPhotos")}.`,
  },
  {
    name: "inspectionMediaRetentionMonths",
    label: "Media retention (months)",
    hint: `${range("inspectionMediaRetentionMonths")}. Stored and validated, but no job deletes inspection media on this schedule yet.`,
  },
];

const PAYOUT_FIELDS: FieldSpec[] = [
  {
    name: "checkinAdvancePct",
    label: "Advance at check-in (%)",
    hint: `Share of the subtotal advanced to the host when check-in is confirmed. ${range("checkinAdvancePct")}; 0 disables it.`,
  },
];

const TAX_BASE_LABELS: Record<(typeof TAX_BASES)[number], string> = {
  commission: "The platform commission",
  subtotal: "The rental subtotal",
  total: "The booking total",
};

export function PlatformConfigForm({ config }: { config: PlatformConfig }) {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const form = useForm<PlatformConfigFormValues>({
    resolver: zodResolver(platformConfigFormSchema),
    defaultValues: configToFormValues(config),
  });

  const mutation = useMutation({
    mutationFn: AdminApi.updateConfig,
    onSuccess: (next) => {
      qc.setQueryData<PlatformConfig>(adminKeys.config(), next);
      // Reset from the SERVER's answer, not the submitted values: the response
      // is the complete stored config, so the form shows what is in the
      // database rather than what the admin hoped would land there.
      form.reset(configToFormValues(next));
      setSaved(true);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.config() });
      // The cancellation figures are republished through GET /legal/current.
      void qc.invalidateQueries({ queryKey: legalKeys.all });
    },
  });

  const dirty = form.formState.isDirty;

  return (
    <form
      noValidate
      onChange={() => setSaved(false)}
      onSubmit={form.handleSubmit((values) => {
        setSaved(false);
        const patch = formValuesToPatch(values, form.formState.dirtyFields);
        if (Object.keys(patch).length === 0) return;
        mutation.mutate(patch);
      })}
    >
      <fieldset disabled={mutation.isPending} className="space-y-6">
        <Section
          title="Commission and tax"
          description="Applied to new bookings. Both figures are frozen onto each booking at request time."
        >
          <FieldGrid>
            {COMMISSION_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
            <TextInput
              field={{
                name: "taxRatePct",
                label: "Tax rate (%)",
                hint: `${range("taxRatePct")}, up to two decimals.`,
                inputMode: "decimal",
              }}
              form={form}
            />
            <EnumInput form={form} />
          </FieldGrid>
          <TaxDefectWarning />
        </Section>

        <Section
          title="Cancellation policy"
          description="Published to customers on the legal pages and snapshotted into each settlement."
        >
          <FieldGrid>
            {POLICY_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
          </FieldGrid>
        </Section>

        <Section
          title="Claims and disputes"
          description="The two deadlines the rental agreement states and the claims engine enforces."
        >
          <FieldGrid>
            {CLAIM_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
          </FieldGrid>
        </Section>

        <Section
          title="Deposits"
          description="What is held on the renter's card, and when the hold is refreshed."
        >
          <FieldGrid>
            {DEPOSIT_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
          </FieldGrid>
        </Section>

        <Section
          title="Inspections"
          description="Photo check-in and check-out (ADR-0011)."
        >
          <CheckboxInput
            name="inspectionsRequired"
            label="Require a finalized inspection for online pickups and returns"
            form={form}
          />
          <FieldGrid>
            {INSPECTION_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
          </FieldGrid>
        </Section>

        <Section
          title="Payouts"
          description="How and when hosts are paid (ADR-0012)."
        >
          <CheckboxInput
            name="stripePayoutsEnabled"
            label="Enable Stripe payouts to hosts"
            form={form}
          />
          <FieldGrid>
            {PAYOUT_FIELDS.map((field) => (
              <TextInput key={field.name} field={field} form={form} />
            ))}
          </FieldGrid>
        </Section>

        {/*
          STICKY, because this form is long enough that Save sat below the fold
          and the console now scrolls inside its own pane — so there is no
          window scrollbar hinting that anything follows. An action you have to
          go looking for is one people assume is missing.

          `-mx-6 px-6` lets the bar bleed to the edges of the content padding
          so it reads as a bar rather than a floating card, and the backdrop
          blur keeps the fields legible as they pass underneath.
        */}
        <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center gap-3 border-t border-border bg-background/85 px-6 py-3 backdrop-blur-md">
          <Button type="submit" disabled={!dirty || mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!dirty || mutation.isPending}
            onClick={() => {
              form.reset(configToFormValues(config));
              setSaved(false);
              mutation.reset();
            }}
          >
            Discard changes
          </Button>
          {mutation.error ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(mutation.error, "Could not save the settings.")}
            </p>
          ) : saved && !dirty ? (
            <p className="text-sm text-success" role="status">
              Settings saved.
            </p>
          ) : null}
        </div>
      </fieldset>
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

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function TextInput({
  field,
  form,
}: {
  field: FieldSpec;
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
}) {
  const id = useId();
  const error = form.formState.errors[field.name];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        inputMode={field.inputMode ?? "numeric"}
        aria-invalid={!!error}
        aria-describedby={`${id}-hint`}
        {...form.register(field.name)}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {field.hint}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function EnumInput({
  form,
}: {
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
}) {
  const id = useId();
  const error = form.formState.errors.taxBase;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Tax applies to</Label>
      <Select id={id} aria-invalid={!!error} {...form.register("taxBase")}>
        {TAX_BASES.map((base) => (
          <option key={base} value={base}>
            {TAX_BASE_LABELS[base]}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted-foreground">
        A fiscal decision, not a platform default — in the DR, ITBIS is owed on
        the service fee rather than on the host&apos;s rental price.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function CheckboxInput({
  name,
  label,
  form,
}: {
  name: "inspectionsRequired" | "stripePayoutsEnabled";
  label: string;
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        className="h-4 w-4 accent-primary"
        {...form.register(name)}
      />
      {label}
    </label>
  );
}

/**
 * The tax rate is editable, and it is also KNOWN BROKEN above zero: hiding
 * either fact would be worse than stating both. An admin who needs the field
 * should see why the number is still 0.
 */
function TaxDefectWarning() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning-soft px-4 py-3"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="space-y-1 text-sm">
        <p className="font-medium text-warning">
          Open defect — leave the tax rate at 0 for now
        </p>
        <p className="text-muted-foreground">
          A partial refund does not adjust the tax. On an early return the
          booking keeps the tax computed on the original amount while only the
          unused days are refunded, so any rate above 0 over-charges the renter
          on every shortened rental. Cancellations are unaffected: they remit no
          tax at all.
        </p>
      </div>
    </div>
  );
}
