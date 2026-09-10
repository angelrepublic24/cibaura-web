import { z } from "zod";
import { wholeUnitsToCents } from "@/shared/utils/money";

/**
 * Zod schemas for the agency-operations forms (ADR-0011 inspections,
 * ADR-0013 claims). Bounds mirror the backend DTOs (spec §4 B8/B9); the
 * server re-validates everything.
 */

// ── Inspection details (`PATCH /agency/inspections/:id`) ───────────────────

export const INSPECTION_NOTES_MAX = 4000;
/** Odometers roll over well before this; guards a mistyped extra digit. */
export const ODOMETER_MAX_KM = 9_999_999;

/** Fuel gauge in eighths, as `<select>` option values ("0" = empty … "8" = full). */
export const FUEL_LEVEL_OPTIONS = [
  { value: "0", label: "Empty" },
  { value: "1", label: "1/8" },
  { value: "2", label: "1/4" },
  { value: "3", label: "3/8" },
  { value: "4", label: "1/2" },
  { value: "5", label: "5/8" },
  { value: "6", label: "3/4" },
  { value: "7", label: "7/8" },
  { value: "8", label: "Full" },
] as const;

const FUEL_LEVEL_VALUES = FUEL_LEVEL_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

export const inspectionDetailsSchema = z
  .object({
    odometerKm: z
      .number({ error: "Enter the odometer reading in kilometres" })
      .int("Whole kilometres only")
      .min(0, "The odometer cannot be negative")
      .max(ODOMETER_MAX_KM, "That reading looks too high — check the digits"),
    fuelLevelEighths: z.enum(FUEL_LEVEL_VALUES, {
      error: "Choose the fuel level",
    }),
    damageFlagged: z.boolean(),
    damageNotes: z
      .string()
      .trim()
      .max(
        INSPECTION_NOTES_MAX,
        `Keep the notes to ${INSPECTION_NOTES_MAX} characters or fewer`,
      ),
  })
  .superRefine((values, ctx) => {
    if (values.damageFlagged && values.damageNotes.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["damageNotes"],
        message: "Describe the damage you found — the claim reviewers read this",
      });
    }
  });
export type InspectionDetailsFormValues = z.infer<typeof inspectionDetailsSchema>;

// ── Customer absent (`POST /agency/inspections/:id/customer-absent`) ───────

/** Backend `CustomerAbsentDto`: reason 2..300. */
export const CUSTOMER_ABSENT_REASON_MIN = 2;
export const CUSTOMER_ABSENT_REASON_MAX = 300;

// ── Damage claim (`POST /agency/requests/:bookingId/claims`) ───────────────

export const CLAIM_DESCRIPTION_MIN = 10;
export const CLAIM_DESCRIPTION_MAX = 4000;
export const CLAIM_EVIDENCE_MAX = 20;

/**
 * The claim form. The amount is typed in whole units (e.g. "125.50") and
 * converted to cents at the input boundary; `maxCents` is the deposit the
 * claim can be collected from (the server enforces its own 400
 * CLAIM_AMOUNT_EXCEEDS_LIMIT on top), `maxLabel` its formatted display.
 */
export function buildFileClaimSchema(maxCents: number, maxLabel: string) {
  return z.object({
    amount: z
      .number({ error: "Enter the amount you are claiming" })
      .positive("The amount must be greater than zero")
      .refine(
        (units) => wholeUnitsToCents(units) <= maxCents,
        `Claims are capped at the deposit on hold (${maxLabel})`,
      ),
    description: z
      .string()
      .trim()
      .min(
        CLAIM_DESCRIPTION_MIN,
        `Describe the damage in at least ${CLAIM_DESCRIPTION_MIN} characters`,
      )
      .max(
        CLAIM_DESCRIPTION_MAX,
        `Keep the description to ${CLAIM_DESCRIPTION_MAX} characters or fewer`,
      ),
    evidenceMediaIds: z
      .array(z.string())
      .max(CLAIM_EVIDENCE_MAX, `Attach at most ${CLAIM_EVIDENCE_MAX} files`),
  });
}
export type FileClaimFormValues = z.infer<ReturnType<typeof buildFileClaimSchema>>;
