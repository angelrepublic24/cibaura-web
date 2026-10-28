import { z } from "zod";
import {
  CAR_CATEGORIES,
  CAR_COLORS,
  CAR_DOCUMENT_STATUSES,
  CAR_DOCUMENT_TYPE_REGISTRATION,
  FUEL_TYPES,
  MEDIA_KINDS,
  MEDIA_LABELS,
  PAYOUT_ACCOUNT_STATUSES,
  PAYOUT_KINDS,
  PAYOUT_METHODS,
  PAYOUT_RAIL_STATUSES,
  PAYOUT_STATUSES,
  TRANSMISSIONS,
} from "@/shared/types/domain";
import { wholeUnitsToCents } from "@/shared/utils/money";
import { carStatusSchema, carWireSchema, paginatedWireSchema } from "@/shared/api/wire";
import {
  agencyKindSchema,
  agencyVerificationStatusSchema,
} from "@/modules/agencies/schema/agencies.schema";
import {
  bookingWireSchema,
  inspectionMediaWireSchema,
} from "@/modules/bookings/schema/bookings.schema";
import {
  contractDocumentWireSchema,
  contractTemplatePublicWireSchema,
} from "@/modules/legal/schema/legal.schema";

/**
 * Agency-dashboard wire schemas, request bodies and form schemas (zod v4).
 *
 * `AgencyService` validates every response against the wire schemas here.
 * Everything is scoped to the CALLER's agency by RBAC — no agencyId in any
 * path — and every amount is server-decided integer cents, rendered
 * verbatim.
 */

// ── Agency, settings & session ──────────────────────────────────────────────

export const payoutAccountTypeSchema = z.enum(["checking", "savings"]);

/** Visible ONLY to `agency:settings` holders. */
export const payoutBankDetailsWireSchema = z.object({
  bankName: z.string(),
  accountHolder: z.string(),
  accountNumber: z.string(),
  accountType: payoutAccountTypeSchema,
  currency: z.string(),
});

/** The agency itself, as its own members read it (`GET /agency/session`). */
export const agencyWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().nullish(),
  verificationStatus: agencyVerificationStatusSchema,
  verificationReason: z.string().nullish(),
  /**
   * What a reviewer asked for while the application is still PENDING. Asking
   * is not a decision, so the status does not move — `null` once the review
   * concludes either way.
   */
  documentsRequested: z
    .object({ note: z.string(), requestedAt: z.string() })
    .nullable(),
  rentalConditions: z.string().nullable(),
  minDriverAge: z.number(),
  depositNote: z.string().nullable(),
  createdAt: z.string(),
  kind: agencyKindSchema,
  hostAgreementSigned: z.boolean(),
  hostAgreementResignRequired: z.boolean(),
});

export const agencySettingsWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  rentalConditions: z.string().nullable(),
  minDriverAge: z.number(),
  depositNote: z.string().nullable(),
  /**
   * The deposit cars inherit when they set none of their own, integer cents.
   * `null` = no default (such a car asks for nothing), `0` = deliberately
   * none, `> 0` = the amount.
   */
  defaultDepositCents: z.number().nullable(),
  payoutBankDetails: payoutBankDetailsWireSchema.nullable(),
});

// ── RBAC (mirror of backend `common/types/permissions.ts`, ADR-0005) ────────

/**
 * Frontend MIRROR of the backend agency permission list. Keep the two in
 * lockstep — this is one of the ADR-0005 permission-mirror sites.
 */
export const AGENCY_PERMISSIONS = [
  "fleet:read",
  "fleet:write",
  "bookings:read",
  "bookings:handle",
  "calendar:manage",
  "branches:manage",
  "zones:manage",
  "wallet:view",
  "wallet:withdraw",
  "messages:handle",
  "staff:manage",
  "agency:settings",
  "reports:view",
] as const;

export const agencyPermissionSchema = z.enum(AGENCY_PERMISSIONS);
/** `owner` is implicit (it holds everything) and is never assigned. */
export const assignableRoleSchema = z.enum(["manager", "sales", "custom"]);
export const staffRoleSchema = z.enum([
  "owner",
  "manager",
  "sales",
  "custom",
]);

export const branchScopeWireSchema = z.object({
  mode: z.enum(["all", "branches"]),
  branchIds: z.array(z.string()),
});

export const permissionContextWireSchema = z.object({
  role: staffRoleSchema,
  permissions: z.array(agencyPermissionSchema),
  branchScope: branchScopeWireSchema,
});

export const agencySessionWireSchema = z.object({
  agency: agencyWireSchema,
  membership: permissionContextWireSchema,
});

export const staffMemberWireSchema = z.object({
  /** The staff user's id. */
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: assignableRoleSchema,
  permissions: z.array(agencyPermissionSchema),
  branchScope: branchScopeWireSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
});

// ── Fleet ───────────────────────────────────────────────────────────────────

export const carDocumentStatusSchema = z.enum(CAR_DOCUMENT_STATUSES);

export const carDocumentWireSchema = z.object({
  id: z.string(),
  type: z.literal(CAR_DOCUMENT_TYPE_REGISTRATION),
  status: carDocumentStatusSchema,
  filename: z.string(),
  contentType: z.string(),
  rejectionReason: z.string().nullable(),
  uploadedAt: z.string(),
  reviewedAt: z.string().nullable(),
});

/** The agency's own view of a car: the private plate + the catalog ids. */
export const agencyCarWireSchema = carWireSchema.extend({
  plate: z.string().optional(),
  makeId: z.string().optional(),
  modelId: z.string().optional(),
  /**
   * The RAW stored deposit of this car, integer cents: `null` = inherit the
   * agency's value, `0` = none even if the agency asks for one, `> 0` = this
   * car's own figure.
   */
  depositOverrideCents: z.number().nullable(),
  /** What the car -> agency -> platform chain yields today, integer cents. */
  resolvedDepositCents: z.number(),
  /** `resolvedDepositCents > 0`; `false` means damage cannot be claimed. */
  depositRequired: z.boolean(),
  registration: carDocumentWireSchema.nullable(),
});

/**
 * One gallery photo as the managing agency sees it. `url` is an API path
 * (`/cars/photos/:id`) — resolve with `resolveCarPhotoUrl` before rendering.
 * `position` 0 is the cover photo.
 */
export const carPhotoWireSchema = z.object({
  id: z.string(),
  url: z.string(),
  position: z.number(),
});

// ── Calendar ────────────────────────────────────────────────────────────────

export const occupancyEntryWireSchema = z.object({
  id: z.string(),
  carId: z.string(),
  startDate: z.string(),
  /** Half-open `[startDate, endDate)`. */
  endDate: z.string(),
  source: z.enum(["booking", "manual_block"]),
  bookingId: z.string().optional(),
  note: z.string().optional(),
});

// ── Branches & zones ────────────────────────────────────────────────────────

export const branchWireSchema = z.object({
  id: z.string(),
  agencyId: z.string(),
  cityId: z.string(),
  name: z.string(),
  address: z.string(),
  phone: z.string().nullable(),
  /** `{ day: "HH:MM-HH:MM" }` map, or `null` when unset. */
  hours: z.record(z.string(), z.string()).nullable(),
  isActive: z.boolean(),
  /** Embedded city ref from the serializer, or null. */
  city: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Coordinates (the delivery origin) + door-to-door delivery config. */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  deliveryEnabled: z.boolean(),
  deliveryBaseFeeCents: z.number(),
  deliveryPerKmCents: z.number(),
  deliveryMaxKm: z.number().nullable(),
});

/**
 * Agency-facing zone (`DeliveryZoneFullDto`): `feeCents` is the host's own
 * figure, and `isActive` is the flag the dashboard manages. The renter's
 * copy lives on `CarDetail.deliveryZones` with the commission folded in.
 */
export const deliveryZoneFullWireSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  name: z.string(),
  feeCents: z.number(),
  isActive: z.boolean(),
});

// ── Requests (the agency inbox) ─────────────────────────────────────────────

/**
 * One inbox row: the standard booking plus `expiresAt` — the instant the
 * request auto-expires (requestedAt + the platform's expiry hours), `null`
 * once the booking left `requested`.
 */
export const agencyRequestWireSchema = bookingWireSchema.extend({
  expiresAt: z.string().nullable(),
});

/**
 * WHAT CANCELLING WOULD COST THE AGENCY, quoted by the same server function
 * that later charges — these figures are never re-derived here, because a
 * second copy of a money rule drifts the first time either moves.
 */
export const agencyCancellationCoverWireSchema = z.object({
  /**
   * nothing_captured — the renter's card is only on hold; cancelling is free
   * standard         — charged, and the pick-up is still far off
   * late             — charged, and close enough that the trip is at risk
   */
  tier: z.enum(["nothing_captured", "standard", "late"]),
  coverCents: z.number(),
  /** The slice that reimburses the fee the card processor keeps. */
  processingFeeCents: z.number(),
  /** The slice that reaches the renter. */
  renterCreditCents: z.number(),
  /** ISO instant the renter's card is charged; null once it has been. */
  chargeableFrom: z.string().nullable(),
  /** ISO instant the cover rises to the late tier; null once it has. */
  lateFrom: z.string().nullable(),
  lateCoverCents: z.number(),
  currency: z.string(),
});

// ── Inspections (ADR-0011) ──────────────────────────────────────────────────

/** A `pending_upload` row plus the single-use signed PUT that fills it. */
export const inspectionMediaUploadWireSchema = z.object({
  media: inspectionMediaWireSchema,
  upload: z.object({
    url: z.string(),
    method: z.literal("PUT"),
    headers: z.record(z.string(), z.string()),
    expiresAt: z.string(),
  }),
});

// ── Renter identity (ADR-0011) ──────────────────────────────────────────────

/**
 * The renter's licence facts plus SHORT-LIVED signed document URLs. Shared
 * only from acceptance until the booking settles; the server logs every read
 * for the "who saw my licence" audit.
 */
export const renterLicenseWireSchema = z.object({
  fullName: z.string(),
  licenseNumber: z.string(),
  licenseExpiry: z.string().nullable(),
  documents: z.array(
    z.object({
      type: z.string(),
      url: z.string(),
      expiresAt: z.string(),
    }),
  ),
});

// ── Wallet, earnings & payouts ──────────────────────────────────────────────

export const payoutStatusSchema = z.enum(PAYOUT_STATUSES);
export const payoutKindSchema = z.enum(PAYOUT_KINDS);
export const payoutMethodSchema = z.enum(PAYOUT_METHODS);
export const payoutRailStatusSchema = z.enum(PAYOUT_RAIL_STATUSES);
export const payoutAccountStatusSchema = z.enum(PAYOUT_ACCOUNT_STATUSES);

export const walletAccountWireSchema = z.object({
  id: z.string(),
  balanceCents: z.number(),
  currency: z.string(),
});

/**
 * `kind` stays a plain string on purpose: an unknown backend kind falls back
 * to the raw value in `ledgerKindLabel` rather than blanking the row.
 */
export const ledgerEntryWireSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  bookingId: z.string().optional(),
  /** Signed: credit > 0, debit < 0. */
  amountCents: z.number(),
  description: z.string(),
  kind: z.string(),
  /** Set on `payout` debits — the payout the money left with. */
  payoutId: z.string().optional(),
  createdAt: z.string(),
});

export const payoutAccountWireSchema = z.object({
  status: payoutAccountStatusSchema,
  rail: z.string(),
  /** Stripe requirement keys still due (shown verbatim as a hint list). */
  requirementsDue: z.array(z.string()),
  payoutMethod: z
    .object({
      bankName: z.string().nullable(),
      last4: z.string().nullable(),
      currency: z.string(),
    })
    .nullable(),
  /** False when the rail is disabled by platform config / driver. */
  onboardingAvailable: z.boolean(),
  lastSyncedAt: z.string().nullable(),
});

export const agencyWalletWireSchema = z.object({
  account: walletAccountWireSchema,
  /** Sum of payouts still `requested` — money already spoken for. */
  pendingPayoutCents: z.number(),
  /** balance − pending; the cap for a new payout request. */
  availableCents: z.number(),
  entries: z.array(ledgerEntryWireSchema),
  /** Stripe payout recipient; null when the rail is not configured. */
  payoutAccount: payoutAccountWireSchema.nullable(),
});

export const earningsBucketWireSchema = z.object({
  periodStart: z.string(),
  earnedCents: z.number(),
});

export const agencyEarningsWireSchema = z.object({
  currency: z.string(),
  /** Withdrawable now; leaves automatically on `nextPayoutAt`. */
  availableCents: z.number(),
  /** Credited and visible, not yet theirs to take. */
  heldCents: z.number(),
  /** Each held piece, so the UI can say why it waits and until when. */
  held: z.array(
    z.object({
      bookingId: z.string().nullable(),
      amountCents: z.number(),
      availableAt: z.string(),
    }),
  ),
  /** Earned by rentals under way; arrives when the booking settles. */
  pendingCents: z.number(),
  nextPayoutAt: z.string(),
  history: z.object({
    /** Bucket starts as `YYYY-MM-DD` in the business timezone, newest first. */
    day: z.array(earningsBucketWireSchema),
    week: z.array(earningsBucketWireSchema),
    month: z.array(earningsBucketWireSchema),
  }),
});

export const payoutWireSchema = z.object({
  id: z.string(),
  agencyId: z.string(),
  amountCents: z.number(),
  currency: z.string(),
  status: payoutStatusSchema,
  /** Bank transfer reference, set by the admin when paid. */
  reference: z.string().nullable(),
  note: z.string().nullable(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  method: payoutMethodSchema,
  kind: payoutKindSchema,
  /** The booking a settlement/advance payout belongs to; null for withdrawals. */
  bookingId: z.string().nullable(),
  /** Stripe payouts only. */
  railStatus: payoutRailStatusSchema.nullable(),
  /** What Stripe posted to the host's bank (minor units + currency). */
  receivedAmount: z
    .object({ value: z.number(), currency: z.string() })
    .nullable(),
  failureReason: z.string().nullable(),
});

// ── Host agreement (ADR-0010) ───────────────────────────────────────────────

export const hostAgreementStatusWireSchema = z.object({
  /** The published version rendered with this host's variables. */
  current: contractTemplatePublicWireSchema,
  /** The host's signed document, or null before the first signature. */
  signed: contractDocumentWireSchema.nullable(),
  /** A newer version was published with `requireResign` — nag, never block. */
  resignRequired: z.boolean(),
});

// ── List wrappers ───────────────────────────────────────────────────────────

export const agencyCarPageWireSchema = paginatedWireSchema(agencyCarWireSchema);
export const agencyRequestPageWireSchema = paginatedWireSchema(
  agencyRequestWireSchema,
);
export const carDocumentListWireSchema = z.array(carDocumentWireSchema);
export const carPhotoListWireSchema = z.array(carPhotoWireSchema);
export const occupancyListWireSchema = z.array(occupancyEntryWireSchema);
export const branchListWireSchema = z.array(branchWireSchema);
export const deliveryZoneFullListWireSchema = z.array(
  deliveryZoneFullWireSchema,
);
export const payoutListWireSchema = z.array(payoutWireSchema);
export const staffListWireSchema = z.array(staffMemberWireSchema);

// ── Request bodies ──────────────────────────────────────────────────────────

/** `GET /agency/fleet` query — `pageSize` lets pickers walk the whole fleet. */
export const fleetFiltersSchema = z.object({
  status: carStatusSchema.optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

/** `GET /agency/requests` query. */
export const requestFiltersSchema = z.object({
  state: z.string().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

/**
 * `PATCH /agency/settings` body (backend `UpdateAgencySettingsDto`). Every
 * field is optional — send only what changed. `payoutBankDetails: null`
 * clears the bank account, `logoUrl: null` removes the logo; an empty
 * `rentalConditions` string clears the conditions server-side.
 */
export const updateAgencySettingsInputSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  logoUrl: z.string().nullish(),
  /** Storefront banner url; `null` clears it (mirrors `logoUrl`). */
  bannerUrl: z.string().nullish(),
  rentalConditions: z.string().optional(),
  minDriverAge: z.number().optional(),
  depositNote: z.string().optional(),
  /**
   * The deposit cars inherit when they set none of their own, 0..500000
   * cents. `null` CLEARS the default (such a car then asks for nothing);
   * omitting the field leaves it alone.
   */
  defaultDepositCents: z.number().nullish(),
  payoutBankDetails: payoutBankDetailsWireSchema.nullish(),
});

export const createStaffInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  role: assignableRoleSchema,
  permissions: z.array(agencyPermissionSchema).optional(),
  branchScopeMode: z.enum(["all", "branches"]),
  branchIds: z.array(z.string()).optional(),
});

export const updateStaffInputSchema = z.object({
  role: assignableRoleSchema.optional(),
  permissions: z.array(agencyPermissionSchema).optional(),
  branchScopeMode: z.enum(["all", "branches"]).optional(),
  branchIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const createCarInputSchema = z.object({
  branchId: z.string(),
  /** From the catalog — never free text. */
  makeId: z.string(),
  /** Dependent on `makeId`. */
  modelId: z.string(),
  year: z.number(),
  color: z.enum(CAR_COLORS),
  transmission: z.enum(TRANSMISSIONS),
  fuel: z.enum(FUEL_TYPES),
  seats: z.number(),
  category: z.enum(CAR_CATEGORIES),
  /** Private — agency-only. */
  plate: z.string(),
  /**
   * The HOST's own per-day rate, integer cents; the renter-facing one is
   * derived server-side and comes back as `renterDailyRateCents`.
   */
  pricePerDayCents: z.number(),
  /**
   * The car's stored deposit decision, integer cents — read back as
   * `depositOverrideCents`. Omitted / `null` = inherit (agency default, then
   * the platform's), `0` = none even if the agency asks for one, `> 0` = this
   * car's own figure.
   */
  depositCents: z.number().nullish(),
  photos: z.array(z.string()).optional(),
});

/**
 * `PATCH /agency/fleet/:carId` body (backend `UpdateCarDto` = partial
 * `CreateCarDto` minus `branchId`, plus `status`). Activation
 * (`status: "active"`) is gated server-side: agency verified ∧ host
 * agreement signed ∧ (business ∨ verified registration document).
 */
export const updateCarInputSchema = createCarInputSchema
  .omit({ branchId: true })
  .partial()
  .extend({ status: carStatusSchema.optional() });

export const createBranchInputSchema = z.object({
  cityId: z.string(),
  name: z.string(),
  address: z.string(),
  /** Omitted = unchanged/none; `null` (edit only) clears the stored number. */
  phone: z.string().nullish(),
  /** `{ day: "HH:MM-HH:MM" }` map; omitted in the v1 branches form. */
  hours: z.record(z.string(), z.string()).optional(),
  // ── Door-to-door delivery config ──
  /** Branch coordinates (the delivery origin) + fee params. */
  lat: z.number().optional(),
  lng: z.number().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryBaseFeeCents: z.number().optional(),
  deliveryPerKmCents: z.number().optional(),
  deliveryMaxKm: z.number().optional(),
});

/** Partial branch edit + the `isActive` toggle (backend `UpdateBranchDto`). */
export const updateBranchInputSchema = createBranchInputSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const manualBlockInputSchema = z.object({
  carId: z.string(),
  from: z.string(),
  /** Half-open `[from, to)`. */
  to: z.string(),
  note: z.string().optional(),
});

/** `POST /agency/host-agreement/sign` body (backend `SignContractDto`). */
export const signContractInputSchema = z.object({
  typedName: z.string(),
  acceptTerms: z.literal(true),
  /** The version the signer read — 409 HOST_AGREEMENT_OUTDATED when stale. */
  templateVersion: z.number(),
});

/** `POST /agency/requests/:bookingId/inspections` body. */
export const createInspectionInputSchema = z.object({
  type: z.enum(["checkin", "checkout"]),
});

/** `PATCH /agency/inspections/:id` body — every field optional, draft only. */
export const updateInspectionInputSchema = z.object({
  odometerKm: z.number().optional(),
  /** 0 (empty) … 8 (full). */
  fuelLevelEighths: z.number().optional(),
  /** ≤ 4000 characters. */
  damageNotes: z.string().optional(),
  damageFlagged: z.boolean().optional(),
});

/**
 * `POST /agency/inspections/:id/media` body. The server pins `contentType`
 * and `sizeBytes` into the signed PUT, so the browser must send exactly that
 * file (its Content-Length is set automatically from the blob).
 */
export const registerInspectionMediaInputSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  label: z.enum(MEDIA_LABELS),
  contentType: z.string(),
  sizeBytes: z.number(),
  /** Required for videos (≤ the platform's max seconds). */
  durationSeconds: z.number().optional(),
});

/** `POST /agency/requests/:bookingId/claims` body. */
export const fileClaimInputSchema = z.object({
  /** Integer cents, > 0 (server cap: 400 CLAIM_AMOUNT_EXCEEDS_LIMIT). */
  requestedCents: z.number(),
  /** 10..4000 characters. */
  description: z.string(),
  /** Inspection media ids of THIS booking, ≤ 20. */
  evidenceMediaIds: z.array(z.string()),
});

export const walkInBookingInputSchema = z.object({
  carId: z.string(),
  customerEmail: z.string(),
  /** Used only when the email has no account yet (new guest customer). */
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  start: z.string(),
  end: z.string(),
  pickupType: z.enum(["branch_pickup", "delivery"]).optional(),
  deliveryAddress: z.string().optional(),
  deliveryLat: z.number().optional(),
  deliveryLng: z.number().optional(),
  deliveryReference: z.string().optional(),
});

export const createZoneInputSchema = z.object({
  name: z.string(),
  feeCents: z.number(),
});

// ── Form schemas (agency operations: ADR-0011 inspections, ADR-0013 claims) ─
//
// Bounds mirror the backend DTOs (spec §4 B8/B9); the server re-validates
// everything.

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

// ── Customer absent (`POST /agency/inspections/:id/customer-absent`) ────────

/** Backend `CustomerAbsentDto`: reason 2..300. */
export const CUSTOMER_ABSENT_REASON_MIN = 2;
export const CUSTOMER_ABSENT_REASON_MAX = 300;

// ── Damage claim (`POST /agency/requests/:bookingId/claims`) ────────────────

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
