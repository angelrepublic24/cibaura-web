import { z } from "zod";
import { wholeUnitsToCents } from "@/shared/utils/money";

/**
 * The flat admin configuration contract — `GET` / `PATCH /admin/config`.
 *
 * ONE object, fifteen settings, camelCase, no nesting. Internally the backend
 * keeps them in three different shapes (a scalar commission row, a
 * cancellation-policy JSONB object and per-key `platform_config` rows); that
 * split is storage and never reaches the wire.
 *
 * RANGES ARE THE SERVER'S. {@link PLATFORM_CONFIG_LIMITS} mirrors
 * `PLATFORM_CONFIG_LIMITS` in backend `src/modules/admin/platform-config.service.ts`,
 * which is where `patchConfig` enforces them — the request DTO deliberately
 * validates type only, so that file is the single owner. Duplicating a bound
 * with a different number is exactly how the console ended up capping
 * `earlyReturnPenaltyDays` at 7 while the API accepted 30, which made eleven
 * settings unreachable without a psql session. Change a bound there, change it
 * here, and nowhere else: the form hints and the field schemas both read this.
 */

// ── Server-owned ranges ────────────────────────────────────────────────────

export const PLATFORM_CONFIG_LIMITS = {
  commissionPct: { min: 0, max: 100, decimals: 2 },
  freeCancellationHours: { min: 0, max: 720 },
  lateCancellationRetentionPct: { min: 0, max: 100 },
  earlyReturnPenaltyDays: { min: 0, max: 30 },
  disputeWindowHours: { min: 0, max: 168 },
  claimResponseHours: { min: 12, max: 168 },
  defaultDepositCents: { min: 0, max: 500_000 },
  taxRatePct: { min: 0, max: 50, decimals: 2 },
  checkinAdvancePct: { min: 0, max: 80 },
  depositReauthLeadHours: { min: 6, max: 72 },
  inspectionMinPhotos: { min: 0, max: 30 },
  inspectionMediaRetentionMonths: { min: 3, max: 60 },
} as const satisfies Record<
  string,
  { min: number; max: number; decimals?: number }
>;

/**
 * A setting with a numeric range, i.e. one that appears above. Local: the
 * module's public alias is `PlatformConfigNumericField` in `types/`.
 */
type NumericField = keyof typeof PLATFORM_CONFIG_LIMITS;

/** Backend `TAX_BASES` — which figure the tax rate multiplies (ADR-0002). */
export const TAX_BASES = ["commission", "subtotal", "total"] as const;
export const taxBaseSchema = z.enum(TAX_BASES);

// ── Wire shape ─────────────────────────────────────────────────────────────

/**
 * What `GET`/`PATCH /admin/config` return.
 *
 * Validates TYPE, not range. A stored value can legitimately sit outside the
 * console's editing range — `DEFAULT_COMMISSION_PCT=15.125` at boot passes the
 * backend's env check (`requireFloatInRange(…, 0, 100)`, no decimal cap) and
 * lands here with three decimals even though `patchConfig` only writes two. A
 * read schema that enforced the write range would refuse to load the console
 * over a value the console did not choose, which is worse than showing it.
 * {@link platformConfigFormSchema} is where the write bounds live.
 */
export const platformConfigSchema = z.object({
  commissionPct: z.number(),
  freeCancellationHours: z.number(),
  lateCancellationRetentionPct: z.number(),
  earlyReturnPenaltyDays: z.number(),
  disputeWindowHours: z.number(),
  claimResponseHours: z.number(),
  defaultDepositCents: z.number(),
  taxRatePct: z.number(),
  taxBase: taxBaseSchema,
  checkinAdvancePct: z.number(),
  depositReauthLeadHours: z.number(),
  inspectionsRequired: z.boolean(),
  inspectionMinPhotos: z.number(),
  inspectionMediaRetentionMonths: z.number(),
  stripePayoutsEnabled: z.boolean(),
});

/**
 * The body of `PATCH /admin/config`: the DIFF the console computed. An absent
 * field keeps its stored value, so only dirty fields travel — which is also
 * what lets an admin save the other fourteen while one holds a value this
 * console cannot express.
 */
export const platformConfigPatchSchema = platformConfigSchema.partial();

// ── Form field schemas ─────────────────────────────────────────────────────

/**
 * Inputs are STRINGS, as everywhere else in this console: `valueAsNumber`
 * turns "abc" into NaN and the admin reads "expected number, received nan".
 * A regex plus an explicit range says what to type instead.
 */
function rangeMessage(field: NumericField): string {
  const { min, max } = PLATFORM_CONFIG_LIMITS[field];
  return `Between ${min} and ${max}`;
}

function integerField(field: NumericField) {
  const { min, max } = PLATFORM_CONFIG_LIMITS[field];
  return z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= min && parsed <= max;
    }, rangeMessage(field));
}

function decimalField(field: "commissionPct" | "taxRatePct") {
  const { min, max, decimals } = PLATFORM_CONFIG_LIMITS[field];
  return z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`),
      `Enter a percentage (up to ${decimals} decimals)`,
    )
    .refine((value) => {
      const parsed = Number(value);
      return parsed >= min && parsed <= max;
    }, rangeMessage(field));
}

/**
 * A tax percentage as a form string, exported because /admin/geo edits the
 * same quantity per country: the backend's `UpdateCountryDto` validates
 * 0..50 with two decimals, which is `PLATFORM_CONFIG_LIMITS.taxRatePct`.
 * One owner for the bound, two screens that honour it.
 */
export const taxRatePctFieldSchema = decimalField("taxRatePct");

/**
 * The deposit is stored in integer cents but typed in whole currency units,
 * the same boundary conversion `new-car-form` uses for a daily rate. Two
 * decimals max keeps `wholeUnitsToCents` exact — "50.004" would silently
 * round to a figure the admin never typed.
 */
const depositField = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount, e.g. 200 or 200.50")
  .refine((value) => {
    const cents = wholeUnitsToCents(Number(value));
    const { min, max } = PLATFORM_CONFIG_LIMITS.defaultDepositCents;
    return cents >= min && cents <= max;
  }, `Between ${PLATFORM_CONFIG_LIMITS.defaultDepositCents.min / 100} and ${PLATFORM_CONFIG_LIMITS.defaultDepositCents.max / 100}`);

/**
 * Every editable setting, as the form holds it. Numbers are strings, booleans
 * are booleans (a checkbox gives one), the tax base is its enum.
 */
export const platformConfigFormSchema = z.object({
  commissionPct: decimalField("commissionPct"),
  freeCancellationHours: integerField("freeCancellationHours"),
  lateCancellationRetentionPct: integerField("lateCancellationRetentionPct"),
  earlyReturnPenaltyDays: integerField("earlyReturnPenaltyDays"),
  disputeWindowHours: integerField("disputeWindowHours"),
  claimResponseHours: integerField("claimResponseHours"),
  defaultDepositUnits: depositField,
  taxRatePct: decimalField("taxRatePct"),
  taxBase: taxBaseSchema,
  checkinAdvancePct: integerField("checkinAdvancePct"),
  depositReauthLeadHours: integerField("depositReauthLeadHours"),
  inspectionsRequired: z.boolean(),
  inspectionMinPhotos: integerField("inspectionMinPhotos"),
  inspectionMediaRetentionMonths: integerField(
    "inspectionMediaRetentionMonths",
  ),
  stripePayoutsEnabled: z.boolean(),
});
