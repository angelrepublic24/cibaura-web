import { z } from "zod";
import {
  BOOKING_STATES,
  CONTRACT_TEMPLATE_STATUSES,
} from "@/shared/types/domain";
import { paginatedWireSchema } from "@/shared/api/wire";
import {
  agencyApplicationWireSchema,
  agencyKindSchema,
  agencyVerificationStatusSchema,
} from "@/modules/agencies/schema/agencies.schema";
import {
  bookingDetailWireSchema,
  claimWireSchema,
  depositWireSchema,
  inspectionWireSchema,
} from "@/modules/bookings/schema/bookings.schema";
import { contractKindSchema } from "@/modules/legal/schema/legal.schema";
import {
  agencyCarWireSchema,
  carDocumentWireSchema,
  payoutAccountWireSchema,
  payoutBankDetailsWireSchema,
  payoutWireSchema,
} from "@/modules/agency/schema/agency.schema";

/**
 * Platform-admin wire schemas, query params and request bodies (zod v4).
 *
 * `AdminService` validates every response against these. All money is
 * INTEGER CENTS, dates are ISO strings and ranges are half-open — the
 * console renders the server's figures and never recomputes one.
 *
 * The flat 15-setting platform configuration has its own contract in
 * `schema/platform-config.schema.ts`, where the schema and the
 * server-owned ranges live together.
 */

// ── Ops: payouts, users, agency status, booking oversight ───────────────────

/** One row of `GET /admin/payouts` (wire `AdminPayoutDto`). */
export const adminPayoutWireSchema = payoutWireSchema.extend({
  agencyName: z.string(),
  agencySlug: z.string(),
  /** Where to wire the money — null when the agency removed its account. */
  bankDetails: payoutBankDetailsWireSchema.nullable(),
  requestedByName: z.string().nullable(),
  decidedByName: z.string().nullable(),
});

/**
 * One row of `GET /admin/users` (wire `AdminUserDto`). `roles` and `status`
 * stay plain strings: a role the backend adds later must list, not blank the
 * directory.
 */
export const adminUserWireSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  roles: z.array(z.string()),
  agencyId: z.string().nullable(),
  /** `active | suspended | deleted` */
  status: z.string(),
  isGuest: z.boolean(),
  createdAt: z.string(),
});

// ── Console dashboards ──────────────────────────────────────────────────────

/** Per-state booking counts (all eight lifecycle states). */
export const adminBookingStateCountsWireSchema = z.object({
  requested: z.number(),
  accepted: z.number(),
  active: z.number(),
  returned: z.number(),
  settled: z.number(),
  rejected: z.number(),
  cancelled: z.number(),
  expired: z.number(),
});

/** `GET /admin/overview` — platform-wide dashboard snapshot. */
export const adminOverviewWireSchema = z.object({
  agencies: z.object({
    total: z.number(),
    verified: z.number(),
    pending: z.number(),
    rejected: z.number(),
  }),
  bookings: z.object({
    today: z.number(),
    thisMonth: z.number(),
    active: z.number(),
    byState: adminBookingStateCountsWireSchema,
  }),
  revenue: z.object({
    platformBalanceCents: z.number(),
    currency: z.string(),
    thisMonthCents: z.number(),
    allTimeCents: z.number(),
  }),
  pending: z.object({
    applications: z.number(),
    verifications: z.number(),
    /** Payouts a host is waiting on: `requested` plus `processing`. */
    payouts: z.number(),
  }),
});

/** One row of `GET /admin/agencies` (directory across ALL statuses). */
export const adminAgencyRowWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  kind: agencyKindSchema,
  verificationStatus: agencyVerificationStatusSchema,
  cities: z.array(z.string()),
  branchCount: z.number(),
  carCount: z.number(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  createdAt: z.string(),
});

/** One row of `GET /admin/bookings` (platform-wide orders). */
export const adminBookingRowWireSchema = z.object({
  id: z.string(),
  agencyName: z.string(),
  customerName: z.string(),
  car: z.string(),
  start: z.string(),
  /** Exclusive. */
  end: z.string(),
  state: z.enum(BOOKING_STATES),
  totalCents: z.number(),
  commissionCents: z.number(),
  currency: z.string(),
  createdAt: z.string(),
});

/** One platform-wallet ledger entry in `GET /admin/revenue`. */
export const adminRevenueEntryWireSchema = z.object({
  id: z.string(),
  /** Signed: credit > 0, debit < 0. */
  amountCents: z.number(),
  description: z.string(),
  bookingId: z.string().optional(),
  createdAt: z.string(),
});

/** `GET /admin/revenue` — platform earnings + date-filtered ledger. */
export const adminRevenueWireSchema = z.object({
  balanceCents: z.number(),
  currency: z.string(),
  thisMonthCents: z.number(),
  allTimeCents: z.number(),
  /** Newest first, date-filtered. */
  entries: z.array(adminRevenueEntryWireSchema),
});

// ── Contract templates (ADR-0010) ───────────────────────────────────────────

export const contractTemplateStatusSchema = z.enum(
  CONTRACT_TEMPLATE_STATUSES,
);

export const contractTemplateAdminWireSchema = z.object({
  id: z.string(),
  kind: contractKindSchema,
  /** `null` while the template is still a draft. */
  version: z.number().nullable(),
  title: z.string(),
  bodyMarkdown: z.string(),
  status: contractTemplateStatusSchema,
  changeNote: z.string().nullable(),
  requireResign: z.boolean(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
});

/** `GET /admin/contract-templates/:id/preview` — server-rendered HTML. */
export const contractPreviewWireSchema = z.object({ html: z.string() });

// ── Damage claims (ADR-0013) ────────────────────────────────────────────────

export const claimAdminWireSchema = claimWireSchema.extend({
  agencyName: z.string(),
  customerName: z.string(),
  deposit: depositWireSchema.nullable(),
  inspections: z.array(inspectionWireSchema),
});

// ── Car registration documents (ADR-0009) ───────────────────────────────────

export const carDocumentAdminWireSchema = carDocumentWireSchema.extend({
  carId: z.string(),
  agencyId: z.string(),
});

// ── Stripe payout accounts (ADR-0012) ───────────────────────────────────────

export const payoutAccountAdminWireSchema = payoutAccountWireSchema.extend({
  agencyId: z.string(),
  agencyName: z.string(),
  stripeAccountId: z.string().nullable(),
  disabledReason: z.string().nullable(),
});

// ── Integrations (encrypted third-party secrets) ────────────────────────────

/** Where a setting's resolved value currently comes from. */
export const settingSourceSchema = z.enum(["db", "env", "unset"]);

/**
 * One integration setting as the backend serializes it — NEVER plaintext.
 * A secret only ever exposes a masked `preview` (last 4 chars), so a client
 * can never read back a value it just wrote.
 */
export const settingViewWireSchema = z.object({
  key: z.string(),
  group: z.string(),
  label: z.string(),
  secret: z.boolean(),
  source: settingSourceSchema,
  /** A value exists from db OR env. */
  configured: z.boolean(),
  /**
   * Secrets: masked, only the last 4 chars visible (e.g. "••••4242").
   * Non-secrets: the full value. `null` when unset.
   */
  preview: z.string().nullable(),
  /** An env fallback exists for this key. */
  envAvailable: z.boolean(),
  /** When the DB override was last set, else null. */
  updatedAt: z.string().nullable(),
});

export const integrationsViewWireSchema = z.object({
  /**
   * `CONFIG_ENCRYPTION_KEY` present & valid on the server. WRITES of secret
   * keys require it; reads still work through the env fallback.
   */
  masterKeyConfigured: z.boolean(),
  groups: z.array(
    z.object({
      group: z.string(),
      label: z.string(),
      items: z.array(settingViewWireSchema),
    }),
  ),
});

// ── Invites ─────────────────────────────────────────────────────────────────

/** Roles an admin invite can grant (extend for future sub-roles). */
export const INVITE_ROLES = [
  { value: "platform_admin", label: "Platform admin (Root)" },
] as const;

export const inviteRoleSchema = z.enum(["platform_admin"]);

export const adminInviteWireSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  invitedByName: z.string().nullish(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const createdInviteWireSchema = z.object({
  id: z.string(),
  email: z.string(),
  expiresAt: z.string(),
});

export const verifiedInviteWireSchema = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
});

// ── List wrappers ───────────────────────────────────────────────────────────

export const adminPayoutPageWireSchema = paginatedWireSchema(
  adminPayoutWireSchema,
);
export const adminUserPageWireSchema = paginatedWireSchema(adminUserWireSchema);
export const adminAgencyPageWireSchema = paginatedWireSchema(
  adminAgencyRowWireSchema,
);
export const adminBookingPageWireSchema = paginatedWireSchema(
  adminBookingRowWireSchema,
);
export const claimAdminPageWireSchema = paginatedWireSchema(
  claimAdminWireSchema,
);
export const payoutAccountAdminPageWireSchema = paginatedWireSchema(
  payoutAccountAdminWireSchema,
);
export const contractTemplateAdminListWireSchema = z.array(
  contractTemplateAdminWireSchema,
);
export const carDocumentAdminListWireSchema = z.array(
  carDocumentAdminWireSchema,
);
export const agencyCarListWireSchema = z.array(agencyCarWireSchema);
export const agencyApplicationListWireSchema = z.array(
  agencyApplicationWireSchema,
);
export const adminInviteListWireSchema = z.array(adminInviteWireSchema);

// ── Query params ────────────────────────────────────────────────────────────

const page = z.number().optional();
const pageSize = z.number().optional();

/** `GET /admin/payouts`. */
export const adminPayoutsQuerySchema = z.object({
  status: z.string().optional(),
  page,
  pageSize,
});

/** `GET /admin/users` (ILIKE on email/name). */
export const adminUsersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  page,
  pageSize,
});

export const adminClaimsQuerySchema = z.object({
  status: z.string().optional(),
  page,
  pageSize,
});

export const adminPayoutAccountsQuerySchema = z.object({
  status: z.string().optional(),
  page,
  pageSize,
});

export const adminAgenciesQuerySchema = z.object({
  status: agencyVerificationStatusSchema.optional(),
  page,
  pageSize,
});

export const adminBookingsQuerySchema = z.object({
  from: z.string().optional(),
  /** Exclusive. */
  to: z.string().optional(),
  state: z.enum(BOOKING_STATES).optional(),
  page,
  pageSize,
});

export const adminRevenueQuerySchema = z.object({
  from: z.string().optional(),
  /** Exclusive. */
  to: z.string().optional(),
});

// ── Request bodies ──────────────────────────────────────────────────────────

/** `POST /admin/contract-templates`. */
export const createContractTemplateInputSchema = z.object({
  kind: contractKindSchema,
  title: z.string(),
  /** ≤ 60000 characters of Markdown with `{{variable}}` placeholders. */
  bodyMarkdown: z.string(),
  changeNote: z.string().optional(),
});

/** `PATCH /admin/contract-templates/:id` — drafts only (409 TEMPLATE_NOT_DRAFT). */
export const updateContractTemplateInputSchema = z.object({
  title: z.string().optional(),
  bodyMarkdown: z.string().optional(),
  changeNote: z.string().optional(),
});

/**
 * `POST /admin/claims/:id/decide`. `approvedCents = 0` rejects the claim;
 * anything above captures `min(approvedCents, deposit)` from the held
 * deposit (or closes it `approved_uncollectible` when nothing is held).
 */
export const decideClaimInputSchema = z.object({
  approvedCents: z.number(),
  /** 2..1000 — shown to both parties. */
  note: z.string(),
});

/** `PATCH /admin/users/:id/status`. */
export const adminUserStatusTargetSchema = z.enum(["active", "suspended"]);

/** `PATCH /admin/agencies/:id/status` (`suspended` ⇄ `verified`). */
export const adminAgencyStatusTargetSchema = z.enum([
  "suspended",
  "verified",
]);

export const createCityInputSchema = z.object({
  countryId: z.string(),
  name: z.string(),
  slug: z.string().optional(),
});

export const createInviteInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: inviteRoleSchema,
});

export const acceptInviteInputSchema = z.object({
  token: z.string(),
  password: z.string(),
});

// ── Booking oversight ───────────────────────────────────────────────────────

/**
 * `GET /admin/bookings/:id` (wire `AdminBookingDetailDto`): the
 * agency-viewer booking (customer + agreement, no client secret) plus the
 * payment's lifecycle status, or null when no payment row exists (walk-ins).
 */
export const adminBookingDetailWireSchema = bookingDetailWireSchema.extend({
  paymentStatus: z.string().nullable(),
});
