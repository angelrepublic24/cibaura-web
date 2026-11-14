"use client";

import { useId, useMemo, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useUpdatePlatformConfig } from "@/modules/admin/hooks/admin.hook";
import {
  PLATFORM_CONFIG_LIMITS,
  TAX_BASES,
  platformConfigFormSchema,
} from "@/modules/admin/schema/platform-config.schema";
import {
  configToFormValues,
  formValuesToPatch,
} from "@/modules/admin/helpers/admin.helper";
import type {
  PlatformConfig,
  PlatformConfigFormValues,
  PlatformConfigNumericField,
} from "@/modules/admin/types/admin.types";

import { getErrorMessage } from "@/shared/api/errors";
import { SettingGroup, SettingRow } from "@/shared/components/setting-row";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * The platform settings console: all twenty-four settings, ONE save.
 *
 * ONE form, one submit, because the endpoint is atomic: the server
 * range-checks every supplied field before it writes any of them, so a
 * rejected value never leaves the rest half-applied. Only DIRTY fields are
 * sent, which is what keeps a field the console cannot express — a commission
 * booted from env with three decimals — from blocking unrelated changes.
 *
 * ── WHY TABS AND ROWS ────────────────────────────────────────────────────
 *
 * Twenty-four settings in seven stacked cards meant scrolling past everything
 * to reach anything, and a three-column grid of `Label` + `Input` left no room
 * for the sentence that says what a number DOES — so "Advance at acceptance
 * (%)" had to carry its own meaning in four words.
 *
 * Tabs across the top (not a second sidebar — the console deliberately swaps
 * its ONE rail rather than nesting another) put four or five rows on screen
 * at a time, and the row layout gives every setting its explanation and lands
 * every control on the same right edge, so the values read as a column.
 *
 * Inactive tabs are HIDDEN, NOT UNMOUNTED. The form is one atomic save across
 * all seven, so a value typed under Deposits has to survive a trip to Payouts;
 * unmounting would also hide a validation error where nobody could find it.
 * Hiding keeps every input registered, and each tab reports its own unsaved
 * and invalid counts so a problem off-screen still announces itself.
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
  /**
   * The setting's name WITHOUT its unit — the unit is rendered beside the
   * input instead, so "Free cancellation (hours)" becomes "Free cancellation
   * window" with an "h" next to the number. Reading a column of bare numbers
   * is the point; repeating "(hours)" in every label fights it.
   */
  label: string;
  unit?: string;
  /** What changes if you change it. Shown as the row's description. */
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
    label: "Commission",
    unit: "%",
    hint: `Added as a markup on top of the agency's own rate and delivery fee — the agency is credited its price to the cent and the renter never sees this as a separate line. Snapshotted onto each booking, so editing it never re-prices an existing one. ${range("commissionPct")}, up to two decimals.`,
    inputMode: "decimal",
  },
];

const POLICY_FIELDS: FieldSpec[] = [
  {
    name: "freeCancellationHours",
    label: "Free cancellation window",
    unit: "h",
    hint: `How long after the agency accepts the renter can still cancel for nothing. This is also when the card is charged. ${range("freeCancellationHours")}.`,
  },
  {
    name: "freeCancellationCapHoursBeforePickup",
    label: "Cutoff before pickup",
    unit: "h",
    hint: `The free window always ends at least this far before pickup, however long the window above is. ${range("freeCancellationCapHoursBeforePickup")}.`,
  },
  {
    name: "freeCancellationMinHours",
    label: "Minimum free window",
    unit: "h",
    hint: `A last-minute booking still gets at least this much free time, even when the cutoff above would leave none. ${range("freeCancellationMinHours")}.`,
  },
  {
    name: "maxCarChanges",
    label: "Vehicle changes per booking",
    hint: `How many times a renter may swap the car without cancelling. Changes must stay within the same agency. ${range("maxCarChanges")}.`,
  },
  {
    name: "lateCancellationRetentionPct",
    label: "Late cancellation retention",
    unit: "%",
    hint: `Once the free window closes, this share of the subtotal stays with the agency and the rest goes back to the renter. ${range("lateCancellationRetentionPct")}.`,
  },
  {
    name: "earlyReturnPenaltyDays",
    label: "Early return penalty",
    unit: "days",
    hint: `When a renter brings the car back early, the agency keeps this many of the unused days. ${range("earlyReturnPenaltyDays")}.`,
  },
];

const CLAIM_FIELDS: FieldSpec[] = [
  {
    name: "disputeWindowHours",
    label: "Dispute window",
    unit: "h",
    hint: `How long after the return the host may still file a damage claim. ${range("disputeWindowHours")}.`,
  },
  {
    name: "claimResponseHours",
    label: "Claim response",
    unit: "h",
    hint: `How long the renter then has to accept or reject that claim before it escalates. ${range("claimResponseHours")}.`,
  },
];

const DEPOSIT_FIELDS: FieldSpec[] = [
  {
    name: "defaultDepositUnits",
    label: "Default security deposit",
    unit: "USD",
    hint: `Held on the renter's card for any car that sets no deposit of its own. At 0 no deposit is held at all, and the signed rental agreement says damage is settled directly between renter and host. ${DEPOSIT_LIMITS.min / 100} – ${DEPOSIT_LIMITS.max / 100}.`,
    inputMode: "decimal",
  },
  {
    name: "depositReauthLeadHours",
    label: "Re-authorization lead",
    unit: "h",
    hint: `A card hold expires; this is how early it is renewed so a long rental never loses its deposit. ${range("depositReauthLeadHours")}.`,
  },
];

const INSPECTION_FIELDS: FieldSpec[] = [
  {
    name: "inspectionMinPhotos",
    label: "Minimum photos",
    hint: `How many photos an inspection needs before it can be submitted. ${range("inspectionMinPhotos")}.`,
  },
  {
    name: "inspectionMediaRetentionMonths",
    label: "Media retention",
    unit: "months",
    hint: `${range("inspectionMediaRetentionMonths")}. Stored and validated, but no job deletes inspection media on this schedule yet.`,
  },
];

const PAYOUT_FIELDS: FieldSpec[] = [
  {
    name: "acceptanceAdvancePct",
    label: "Advance at acceptance",
    unit: "%",
    hint: `Share of the subtotal paid to the host as soon as they accept, rather than at settlement. ${range("acceptanceAdvancePct")}; 0 disables it.`,
  },
];

const AGENCY_FAILURE_FIELDS: FieldSpec[] = [
  {
    name: "agencyFailurePenaltyPct",
    label: "Cancellation penalty",
    unit: "%",
    hint: `Charged to the agency when it abandons a booking it had already accepted, as a share of the total. ${range("agencyFailurePenaltyPct")}.`,
  },
  {
    name: "agencyFailureLatePenaltyPct",
    label: "Late cancellation penalty",
    unit: "%",
    hint: `The harsher rate, applied when the agency cancels close to pickup. Must be at least the standard penalty. ${range("agencyFailureLatePenaltyPct")}.`,
  },
  {
    name: "agencyFailureLateHours",
    label: "Late window",
    unit: "h",
    hint: `How close to pickup a cancellation has to be to count as late. ${range("agencyFailureLateHours")}.`,
  },
  {
    name: "agencyFailurePenaltyFloorCents",
    label: "Minimum penalty",
    unit: "¢",
    hint: `A floor so a penalty on a cheap booking is still worth collecting. ${range("agencyFailurePenaltyFloorCents")}; 100 cents = USD 1.`,
  },
  {
    name: "gatewayFeeEstimatePct",
    label: "Estimated gateway fee",
    unit: "%",
    hint: `Used to split a penalty between what processing actually cost and what the renter gets credited. ${range("gatewayFeeEstimatePct")}, up to two decimals.`,
    inputMode: "decimal",
  },
  {
    name: "gatewayFeeEstimateFixedCents",
    label: "Fixed gateway fee",
    unit: "¢",
    hint: `The per-transaction part of the same estimate. ${range("gatewayFeeEstimateFixedCents")}; 100 cents = USD 1.`,
  },
];

const TAX_BASE_LABELS: Record<(typeof TAX_BASES)[number], string> = {
  commission: "The platform commission",
  subtotal: "The rental subtotal",
  total: "The booking total",
};

type SectionId =
  | "money"
  | "cancellations"
  | "agency"
  | "claims"
  | "deposits"
  | "inspections"
  | "payouts";

/**
 * The tabs, and WHICH FIELDS EACH ONE OWNS.
 *
 * `owns` is not decoration: it is what lets a tab say "2 unsaved" or flag an
 * invalid value while you are looking at a different tab. Add a field to a
 * section's render without adding it here and its badge silently stops
 * counting — so the list below is the single place a section is defined.
 */
type SectionSpec = {
  id: SectionId;
  tab: string;
  title: string;
  description: string;
  owns: (keyof PlatformConfigFormValues)[];
};

const SECTIONS: SectionSpec[] = [
  {
    id: "money",
    tab: "Commission & tax",
    title: "Commission and tax",
    description:
      "What the platform charges, and what the tax is calculated on. Both figures are frozen onto each booking at request time.",
    owns: ["commissionPct", "taxRatePct", "taxBase"],
  },
  {
    id: "cancellations",
    tab: "Cancellations",
    title: "Cancellation policy",
    description:
      "Published to customers on the legal pages and snapshotted into each settlement.",
    owns: POLICY_FIELDS.map((f) => f.name),
  },
  {
    id: "agency",
    tab: "Agency failures",
    title: "Agency cancellations",
    description:
      "Penalties when a host abandons a confirmed booking, and the processing-fee estimate used for their split.",
    owns: AGENCY_FAILURE_FIELDS.map((f) => f.name),
  },
  {
    id: "claims",
    tab: "Claims",
    title: "Claims and disputes",
    description:
      "The two deadlines the rental agreement states and the claims engine enforces.",
    owns: CLAIM_FIELDS.map((f) => f.name),
  },
  {
    id: "deposits",
    tab: "Deposits",
    title: "Deposits",
    description:
      "What is held on the renter's card, and when the hold is refreshed.",
    owns: DEPOSIT_FIELDS.map((f) => f.name),
  },
  {
    id: "inspections",
    tab: "Inspections",
    title: "Inspections",
    description: "Photo check-in and check-out (ADR-0011).",
    owns: ["inspectionsRequired", ...INSPECTION_FIELDS.map((f) => f.name)],
  },
  {
    id: "payouts",
    tab: "Payouts",
    title: "Payouts",
    description: "How and when hosts are paid (ADR-0012).",
    owns: ["stripePayoutsEnabled", ...PAYOUT_FIELDS.map((f) => f.name)],
  },
];

type FieldFlags = Partial<Record<keyof PlatformConfigFormValues, boolean>>;

export function PlatformConfigForm({ config }: { config: PlatformConfig }) {
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState<SectionId>("money");
  const form = useForm<PlatformConfigFormValues>({
    resolver: zodResolver(platformConfigFormSchema),
    defaultValues: configToFormValues(config),
  });

  // The hook owns the cache (it stores the server's answer and republishes
  // the public legal figures); re-seeding THIS form is its own business.
  const mutation = useUpdatePlatformConfig();

  function submit(patch: Parameters<typeof mutation.mutate>[0]) {
    mutation.mutate(patch, {
      // Reset from the SERVER's answer, not the submitted values: the
      // response is the complete stored config, so the form shows what is in
      // the database rather than what the admin hoped would land there.
      onSuccess: (next) => {
        form.reset(configToFormValues(next));
        setSaved(true);
      },
    });
  }

  // Read the whole formState HERE rather than inside each row: react-hook-form
  // subscribes through a Proxy on property access, so touching `dirtyFields`
  // only in a child would leave this component — and the tab badges — without
  // a re-render when a value changes.
  const { dirtyFields, errors, isDirty } = form.formState;
  const dirty = dirtyFields as FieldFlags;

  const changedCount = useMemo(
    () => Object.values(dirty).filter(Boolean).length,
    [dirty],
  );

  return (
    <form
      noValidate
      onChange={() => setSaved(false)}
      onSubmit={form.handleSubmit((values) => {
        setSaved(false);
        const patch = formValuesToPatch(values, form.formState.dirtyFields);
        if (Object.keys(patch).length === 0) return;
        submit(patch);
      })}
    >
      <fieldset disabled={mutation.isPending}>
        <SectionTabs
          active={active}
          onSelect={setActive}
          dirty={dirty}
          errors={errors}
        />

        {SECTIONS.map((section) => (
          <div
            key={section.id}
            role="tabpanel"
            id={`settings-panel-${section.id}`}
            aria-labelledby={`settings-tab-${section.id}`}
            hidden={section.id !== active}
          >
            <SettingGroup title={section.title} description={section.description}>
              {renderSection(section.id, form, dirty, errors)}
            </SettingGroup>
          </div>
        ))}

        {/*
          STICKY, because the console scrolls inside its own pane — so there is
          no window scrollbar hinting that anything follows, and an action you
          have to go looking for is one people assume is missing.

          `-mx-6 px-6` lets the bar bleed to the edges of the content padding
          so it reads as a bar rather than a floating card, and the backdrop
          blur keeps the rows legible as they pass underneath.
        */}
        <div className="sticky bottom-0 -mx-6 mt-8 flex flex-wrap items-center gap-3 border-t border-border bg-background/85 px-6 py-3 backdrop-blur-md">
          <Button type="submit" disabled={!isDirty || mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save settings"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!isDirty || mutation.isPending}
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
          ) : saved && !isDirty ? (
            <p className="text-sm text-success" role="status">
              Settings saved.
            </p>
          ) : changedCount > 0 ? (
            // Saving is atomic across all seven tabs, so the count has to be
            // global: it is the only thing telling an admin that the tab they
            // are NOT looking at is also about to be written.
            <p className="text-sm text-muted-foreground" role="status">
              <span className="font-semibold text-foreground">
                {changedCount}
              </span>{" "}
              {changedCount === 1 ? "setting" : "settings"} changed, not saved
              yet
            </p>
          ) : null}
        </div>
      </fieldset>
    </form>
  );
}

/** What a tab renders. Kept out of the component so the map above stays readable. */
function renderSection(
  id: SectionId,
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>,
  dirty: FieldFlags,
  errors: FieldErrors<PlatformConfigFormValues>,
): React.ReactNode {
  const rows = (fields: FieldSpec[]) =>
    fields.map((field) => (
      <NumberSetting
        key={field.name}
        field={field}
        form={form}
        changed={!!dirty[field.name]}
        error={errors[field.name]?.message}
      />
    ));

  switch (id) {
    case "money":
      return (
        <>
          {rows(COMMISSION_FIELDS)}
          <NumberSetting
            field={{
              name: "taxRatePct",
              label: "Tax rate",
              unit: "%",
              hint: `Applied to whatever the base below selects. Agencies in other countries can carry their own rate, set under Geo. ${range("taxRatePct")}, up to two decimals.`,
              inputMode: "decimal",
            }}
            form={form}
            changed={!!dirty.taxRatePct}
            error={errors.taxRatePct?.message}
          />
          <TaxBaseSetting
            form={form}
            changed={!!dirty.taxBase}
            error={errors.taxBase?.message}
          />
          <TaxDefectWarning />
        </>
      );
    case "cancellations":
      return rows(POLICY_FIELDS);
    case "agency":
      return rows(AGENCY_FAILURE_FIELDS);
    case "claims":
      return rows(CLAIM_FIELDS);
    case "deposits":
      return rows(DEPOSIT_FIELDS);
    case "inspections":
      return (
        <>
          <SwitchSetting
            name="inspectionsRequired"
            label="Require a finalized inspection"
            hint="Online pickups and returns cannot be completed until the photo inspection is finalized."
            form={form}
            changed={!!dirty.inspectionsRequired}
          />
          {rows(INSPECTION_FIELDS)}
        </>
      );
    case "payouts":
      return (
        <>
          <SwitchSetting
            name="stripePayoutsEnabled"
            label="Pay hosts through Stripe"
            hint="Off means the weekly payout run only creates the request; an admin still moves the money by bank transfer and records the reference."
            form={form}
            changed={!!dirty.stripePayoutsEnabled}
          />
          {rows(PAYOUT_FIELDS)}
        </>
      );
  }
}

function SectionTabs({
  active,
  onSelect,
  dirty,
  errors,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
  dirty: FieldFlags;
  errors: FieldErrors<PlatformConfigFormValues>;
}) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="-mx-6 flex gap-1 overflow-x-auto border-b border-border px-6"
    >
      {SECTIONS.map((section) => {
        const on = section.id === active;
        const changed = section.owns.filter((f) => dirty[f]).length;
        const invalid = section.owns.some((f) => errors[f]);
        return (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`settings-tab-${section.id}`}
            aria-selected={on}
            aria-controls={`settings-panel-${section.id}`}
            onClick={() => onSelect(section.id)}
            className={cn(
              "flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
              on
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {section.tab}
            {/* An invalid value outranks an unsaved one: the save will refuse
                either way, and this is the only hint that the reason is on a
                tab you cannot see. */}
            {invalid ? (
              <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-destructive">
                !
              </span>
            ) : changed > 0 ? (
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-bold text-primary">
                {changed}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function NumberSetting({
  field,
  form,
  changed,
  error,
}: {
  field: FieldSpec;
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
  changed: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <SettingRow
      htmlFor={id}
      name={field.label}
      description={field.hint}
      changed={changed}
      error={error}
      control={
        <div className="flex items-center gap-2">
          <Input
            id={id}
            inputMode={field.inputMode ?? "numeric"}
            aria-invalid={!!error}
            // Right-aligned and tabular so the column of values reads as a
            // column of values, not as a ragged edge.
            className="w-28 text-right font-mono tabular-nums"
            {...form.register(field.name)}
          />
          {field.unit ? (
            <span className="w-12 text-sm text-muted-foreground">
              {field.unit}
            </span>
          ) : (
            <span className="w-12" aria-hidden />
          )}
        </div>
      }
    />
  );
}

function TaxBaseSetting({
  form,
  changed,
  error,
}: {
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
  changed: boolean;
  error?: string;
}) {
  const id = useId();
  return (
    <SettingRow
      htmlFor={id}
      name="Tax applies to"
      description="A fiscal decision, not a platform default — in the DR, ITBIS is owed on the service fee rather than on the host's rental price."
      changed={changed}
      error={error}
      control={
        <Select
          id={id}
          aria-invalid={!!error}
          className="w-full sm:w-[13.5rem]"
          {...form.register("taxBase")}
        >
          {TAX_BASES.map((base) => (
            <option key={base} value={base}>
              {TAX_BASE_LABELS[base]}
            </option>
          ))}
        </Select>
      }
    />
  );
}

function SwitchSetting({
  name,
  label,
  hint,
  form,
  changed,
}: {
  name: "inspectionsRequired" | "stripePayoutsEnabled";
  label: string;
  hint: string;
  form: ReturnType<typeof useForm<PlatformConfigFormValues>>;
  changed: boolean;
}) {
  const id = useId();
  return (
    <SettingRow
      htmlFor={id}
      name={label}
      description={hint}
      changed={changed}
      control={<Switch id={id} {...form.register(name)} />}
    />
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
      className="mt-6 flex items-start gap-3 rounded-[var(--radius)] border border-warning/40 bg-warning-soft px-4 py-3"
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
