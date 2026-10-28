import type { z } from "zod";
import type {
  acceptInviteInputSchema,
  adminAgenciesQuerySchema,
  adminAgencyRowWireSchema,
  adminAgencyStatusTargetSchema,
  adminBookingDetailWireSchema,
  adminBookingRowWireSchema,
  adminBookingStateCountsWireSchema,
  adminBookingsQuerySchema,
  adminClaimsQuerySchema,
  adminInviteWireSchema,
  adminOverviewWireSchema,
  adminPayoutAccountsQuerySchema,
  adminPayoutWireSchema,
  adminPayoutsQuerySchema,
  adminRevenueEntryWireSchema,
  adminRevenueQuerySchema,
  adminRevenueWireSchema,
  adminUserStatusTargetSchema,
  adminUserWireSchema,
  adminUsersQuerySchema,
  createCityInputSchema,
  createContractTemplateInputSchema,
  createInviteInputSchema,
  createdInviteWireSchema,
  decideClaimInputSchema,
  integrationsViewWireSchema,
  inviteRoleSchema,
  settingSourceSchema,
  settingViewWireSchema,
  updateContractTemplateInputSchema,
  verifiedInviteWireSchema,
} from "@/modules/admin/schema/admin.schema";
import type {
  PLATFORM_CONFIG_LIMITS,
  platformConfigFormSchema,
  platformConfigPatchSchema,
  platformConfigSchema,
  taxBaseSchema,
} from "@/modules/admin/schema/platform-config.schema";

// ── Ops ─────────────────────────────────────────────────────────────────────

export type AdminPayout = z.infer<typeof adminPayoutWireSchema>;
export type AdminPayoutsQuery = z.infer<typeof adminPayoutsQuerySchema>;
export type AdminUser = z.infer<typeof adminUserWireSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AdminUserStatusTarget = z.infer<
  typeof adminUserStatusTargetSchema
>;
export type AdminAgencyStatusTarget = z.infer<
  typeof adminAgencyStatusTargetSchema
>;
export type AdminBookingDetail = z.infer<typeof adminBookingDetailWireSchema>;

// ── Console dashboards ──────────────────────────────────────────────────────

export type AdminBookingStateCounts = z.infer<
  typeof adminBookingStateCountsWireSchema
>;
export type AdminOverview = z.infer<typeof adminOverviewWireSchema>;
export type AdminAgencyRow = z.infer<typeof adminAgencyRowWireSchema>;
export type AdminBookingRow = z.infer<typeof adminBookingRowWireSchema>;
export type AdminRevenueEntry = z.infer<typeof adminRevenueEntryWireSchema>;
export type AdminRevenue = z.infer<typeof adminRevenueWireSchema>;
export type AdminAgenciesQuery = z.infer<typeof adminAgenciesQuerySchema>;
export type AdminBookingsQuery = z.infer<typeof adminBookingsQuerySchema>;
export type AdminRevenueQuery = z.infer<typeof adminRevenueQuerySchema>;

// ── Contract templates, claims & documents ──────────────────────────────────

export type CreateContractTemplateInput = z.infer<
  typeof createContractTemplateInputSchema
>;
export type UpdateContractTemplateInput = z.infer<
  typeof updateContractTemplateInputSchema
>;
export type AdminClaimsQuery = z.infer<typeof adminClaimsQuerySchema>;
export type DecideClaimInput = z.infer<typeof decideClaimInputSchema>;
export type AdminPayoutAccountsQuery = z.infer<
  typeof adminPayoutAccountsQuerySchema
>;

// ── Geo ─────────────────────────────────────────────────────────────────────

export type CreateCityInput = z.infer<typeof createCityInputSchema>;

// ── Integrations ────────────────────────────────────────────────────────────

export type SettingSource = z.infer<typeof settingSourceSchema>;
export type SettingView = z.infer<typeof settingViewWireSchema>;
export type IntegrationsView = z.infer<typeof integrationsViewWireSchema>;
export type IntegrationsGroup = IntegrationsView["groups"][number];

// ── Invites ─────────────────────────────────────────────────────────────────

export type InviteRole = z.infer<typeof inviteRoleSchema>;
export type AdminInvite = z.infer<typeof adminInviteWireSchema>;
export type CreatedInvite = z.infer<typeof createdInviteWireSchema>;
export type VerifiedInvite = z.infer<typeof verifiedInviteWireSchema>;
export type CreateInviteInput = z.infer<typeof createInviteInputSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteInputSchema>;

// ── Platform configuration ──────────────────────────────────────────────────

/** Which figure the tax rate multiplies (ADR-0002). */
export type TaxBase = z.infer<typeof taxBaseSchema>;
export type PlatformConfig = z.infer<typeof platformConfigSchema>;
export type PlatformConfigPatch = z.infer<typeof platformConfigPatchSchema>;
export type PlatformConfigFormValues = z.infer<
  typeof platformConfigFormSchema
>;
/** A setting with a numeric range, i.e. one that `PLATFORM_CONFIG_LIMITS` bounds. */
export type PlatformConfigNumericField = keyof typeof PLATFORM_CONFIG_LIMITS;
/** Which form fields the user actually touched (drives the PATCH diff). */
export type DirtyConfigFields = Partial<
  Record<keyof PlatformConfigFormValues, boolean | undefined>
>;
