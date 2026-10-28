import { Api } from "@/shared/api/client";
import type {
  AgencyCar,
  BookingDetail,
  CarDocumentAdminDto,
  CatalogMake,
  CatalogModel,
  City,
  ClaimAdminDto,
  ContractKind,
  ContractTemplateAdminDto,
  Country,
  InspectionDto,
  Paginated,
  PayoutAccountAdminDto,
  SignedUrlDto,
} from "@/shared/types/domain";
import type { AgencyApplication } from "@/modules/agencies/types/agencies.types";
import { agencyApplicationWireSchema } from "@/modules/agencies/schema/agencies.schema";
import {
  agencyApplicationListWireSchema,
  agencyCarListWireSchema,
  adminAgenciesQuerySchema,
  adminAgencyPageWireSchema,
  adminAgencyStatusTargetSchema,
  adminBookingDetailWireSchema,
  adminBookingPageWireSchema,
  adminBookingsQuerySchema,
  adminClaimsQuerySchema,
  adminInviteListWireSchema,
  adminOverviewWireSchema,
  adminPayoutAccountsQuerySchema,
  adminPayoutPageWireSchema,
  adminPayoutWireSchema,
  adminPayoutsQuerySchema,
  adminRevenueQuerySchema,
  adminRevenueWireSchema,
  adminUserPageWireSchema,
  adminUserStatusTargetSchema,
  adminUserWireSchema,
  adminUsersQuerySchema,
  acceptInviteInputSchema,
  carDocumentAdminListWireSchema,
  carDocumentAdminWireSchema,
  claimAdminPageWireSchema,
  claimAdminWireSchema,
  contractPreviewWireSchema,
  contractTemplateAdminListWireSchema,
  contractTemplateAdminWireSchema,
  createCityInputSchema,
  createContractTemplateInputSchema,
  createInviteInputSchema,
  createdInviteWireSchema,
  decideClaimInputSchema,
  integrationsViewWireSchema,
  payoutAccountAdminPageWireSchema,
  payoutAccountAdminWireSchema,
  settingViewWireSchema,
  updateContractTemplateInputSchema,
  verifiedInviteWireSchema,
} from "@/modules/admin/schema/admin.schema";
import {
  platformConfigPatchSchema,
  platformConfigSchema,
} from "@/modules/admin/schema/platform-config.schema";
import type {
  AcceptInviteInput,
  AdminAgenciesQuery,
  AdminAgencyRow,
  AdminAgencyStatusTarget,
  AdminBookingDetail,
  AdminBookingRow,
  AdminBookingsQuery,
  AdminClaimsQuery,
  AdminInvite,
  AdminOverview,
  AdminPayout,
  AdminPayoutAccountsQuery,
  AdminPayoutsQuery,
  AdminRevenue,
  AdminRevenueQuery,
  AdminUser,
  AdminUserStatusTarget,
  AdminUsersQuery,
  CreateCityInput,
  CreateContractTemplateInput,
  CreateInviteInput,
  CreatedInvite,
  DecideClaimInput,
  IntegrationsView,
  PlatformConfig,
  PlatformConfigPatch,
  SettingView,
  UpdateContractTemplateInput,
  VerifiedInvite,
} from "@/modules/admin/types/admin.types";
import { inspectionListWireSchema } from "@/modules/bookings/schema/bookings.schema";
import { bookingDetailWireSchema } from "@/modules/bookings/schema/bookings.schema";
import { signedUrlWireSchema } from "@/modules/bookings/schema/bookings.schema";
import {
  catalogMakeListWireSchema,
  catalogMakeWireSchema,
  catalogModelListWireSchema,
  catalogModelWireSchema,
  cityListWireSchema,
  cityWireSchema,
  countryListWireSchema,
  countryWireSchema,
} from "@/modules/catalog/schema/catalog.schema";

const UNSUPPORTED_CONFIG =
  "The server returned an unsupported configuration. Settings cannot be edited safely.";

const UNCONFIRMED_CONFIG =
  "The server did not confirm the requested values. Changes may have been applied; reload the configuration to verify before retrying.";

/**
 * Platform-admin API client (platform_admin only) — the ONLY thing in the
 * module that talks to the backend. Hooks call these, components call hooks.
 *
 * Config & catalog:
 *  - GET   /admin/config          -> the flat 15-setting PlatformConfig
 *  - PATCH /admin/config          -> the DIFF in, the COMPLETE config out
 *      (commission is SNAPSHOTTED into each booking at request time —
 *       changing it never rewrites existing bookings; the policy figures are
 *       snapshotted into each settlement when it is computed)
 *  - POST  /catalog/makes { name }                 -> CatalogMake  (admin)
 *  - POST  /catalog/makes/:makeId/models { name }  -> CatalogModel (admin)
 *  - PATCH /geo/countries/:countryId { taxRatePct } -> Country
 *      (0..50 with two decimals; `null` clears the country's own rate and
 *       hands it back to the platform `taxRatePct`)
 *  - POST  /geo/cities                              -> City
 * Read views reuse the PUBLIC catalog/geo endpoints (the same data the
 * search facets use).
 *
 * Ops:
 *  - GET   /admin/payouts?status&page&pageSize     -> Paginated<AdminPayout>
 *  - POST  /admin/payouts/:id/pay { reference }    -> AdminPayout
 *      (ONE transaction: debits the agency wallet + marks paid;
 *       409 PAYOUT_NOT_PENDING / INSUFFICIENT_BALANCE)
 *  - POST  /admin/payouts/:id/reject { reason }    -> AdminPayout
 *  - POST  /admin/payouts/:id/retry               -> AdminPayout (failed Stripe)
 *  - GET   /admin/users?q&role&status&page&pageSize -> Paginated<AdminUser>
 *  - PATCH /admin/users/:id/status { status, reason? } -> AdminUser
 *      (400 when targeting yourself or another platform_admin)
 *  - PATCH /admin/agencies/:id/status { status, reason? } -> AgencyApplication
 *      (409 while the agency is pending/rejected — use verify/reject there)
 *  - GET   /admin/bookings/:id                     -> AdminBookingDetail
 *  - POST  /admin/bookings/:id/cancel { reason }   -> BookingDetail
 *
 * Console dashboards: GET /admin/overview | /admin/agencies | /admin/bookings
 * | /admin/revenue.
 *
 * v1 expansion:
 *  - GET/POST/PATCH /admin/contract-templates[...] -> ContractTemplateAdminDto
 *  - POST  /admin/contract-templates/:id/publish { requireResign? }
 *        (400 TEMPLATE_UNKNOWN_VARIABLE lists the offenders)
 *  - GET   /admin/contract-templates/:id/preview   -> { html }
 *  - GET   /admin/contract-documents/:id/pdf       -> SignedUrlDto
 *  - GET   /admin/claims?status&page&pageSize      -> Paginated<ClaimAdminDto>
 *  - GET   /admin/claims/:id                       -> ClaimAdminDto
 *  - POST  /admin/claims/:id/decide                -> ClaimAdminDto
 *  - GET   /bookings/:bookingId/inspections        -> InspectionDto[]
 *  - GET   /admin/cars/:carId/documents[/:docId]   -> rows / file bytes
 *  - PATCH /admin/cars/:carId/documents/:docId/verify | /reject { reason }
 *  - GET   /admin/payout-accounts?status&page&pageSize
 *  - POST  /admin/payout-accounts/:agencyId/disable { reason } | /enable
 *
 * Applications/KYC review (ADR-0004) goes through the `/agencies/applications`
 * routes; integrations and invites have their own admin-gated surfaces.
 *
 * ASSUMED (not in the spec — flagged for the backend): the applicant's cars
 * for the registration-document review, `GET /admin/agencies/:agencyId/cars`.
 */
class AdminService {
  // ── Platform configuration ────────────────────────────────────────────────

  async getConfig(): Promise<PlatformConfig> {
    const res = await Api.get<unknown>("/admin/config");
    const result = platformConfigSchema.safeParse(res.data);
    if (!result.success) throw new Error(UNSUPPORTED_CONFIG);
    return result.data;
  }

  /**
   * `PATCH /admin/config` — ONE write for all fifteen settings.
   *
   * The body is the DIFF the form computed, never the whole object: an absent
   * field keeps its stored value, so a setting the console cannot currently
   * express (a commission booted from env with three decimals, a value a psql
   * session put out of range) does not block saving the others.
   *
   * The response is the COMPLETE config, which is what the caller should put
   * in its state — the server is the one that decides what got stored. Every
   * field we asked for is compared against what came back, because a backend
   * that silently clamped or ignored a value would otherwise leave the console
   * showing numbers that are not in the database.
   */
  async updateConfig(patch: PlatformConfigPatch): Promise<PlatformConfig> {
    const body = platformConfigPatchSchema.parse(patch);
    const res = await Api.patch<unknown>("/admin/config", body);
    const result = platformConfigSchema.safeParse(res.data);
    if (!result.success) throw new Error(UNSUPPORTED_CONFIG);
    const applied = result.data;
    const rejected = Object.entries(body).filter(
      ([field, value]) => applied[field as keyof PlatformConfig] !== value,
    );
    if (rejected.length > 0) throw new Error(UNCONFIRMED_CONFIG);
    return applied;
  }

  // ── Contract templates (ADR-0010) ─────────────────────────────────────────

  async listContractTemplates(
    kind?: ContractKind,
  ): Promise<ContractTemplateAdminDto[]> {
    const res = await Api.get<unknown>("/admin/contract-templates", {
      params: { kind },
    });
    return contractTemplateAdminListWireSchema.parse(res.data);
  }

  async createContractTemplate(
    input: CreateContractTemplateInput,
  ): Promise<ContractTemplateAdminDto> {
    const res = await Api.post<unknown>(
      "/admin/contract-templates",
      createContractTemplateInputSchema.parse(input),
    );
    return contractTemplateAdminWireSchema.parse(res.data);
  }

  async updateContractTemplate(
    id: string,
    input: UpdateContractTemplateInput,
  ): Promise<ContractTemplateAdminDto> {
    const res = await Api.patch<unknown>(
      `/admin/contract-templates/${encodeURIComponent(id)}`,
      updateContractTemplateInputSchema.parse(input),
    );
    return contractTemplateAdminWireSchema.parse(res.data);
  }

  /**
   * Validates every `{{variable}}`, archives the current published version
   * and assigns the next version number. `requireResign` (host kind only)
   * flags every signed host for a new signature — nagged, never blocked.
   */
  async publishContractTemplate(
    id: string,
    requireResign?: boolean,
  ): Promise<ContractTemplateAdminDto> {
    const res = await Api.post<unknown>(
      `/admin/contract-templates/${encodeURIComponent(id)}/publish`,
      { requireResign },
    );
    return contractTemplateAdminWireSchema.parse(res.data);
  }

  /** Server-rendered HTML of the SAVED template with sample variables. */
  async previewContractTemplate(id: string): Promise<{ html: string }> {
    const res = await Api.get<unknown>(
      `/admin/contract-templates/${encodeURIComponent(id)}/preview`,
    );
    return contractPreviewWireSchema.parse(res.data);
  }

  /** Short-lived link to a signed document's PDF (countersigned when present). */
  async contractDocumentPdf(documentId: string): Promise<SignedUrlDto> {
    const res = await Api.get<unknown>(
      `/admin/contract-documents/${encodeURIComponent(documentId)}/pdf`,
    );
    return signedUrlWireSchema.parse(res.data);
  }

  // ── Damage claims (ADR-0013) ──────────────────────────────────────────────

  async listClaims(
    query: AdminClaimsQuery = {},
  ): Promise<Paginated<ClaimAdminDto>> {
    const res = await Api.get<unknown>("/admin/claims", {
      params: adminClaimsQuerySchema.parse(query),
    });
    return claimAdminPageWireSchema.parse(res.data);
  }

  async getClaim(id: string): Promise<ClaimAdminDto> {
    const res = await Api.get<unknown>(
      `/admin/claims/${encodeURIComponent(id)}`,
    );
    return claimAdminWireSchema.parse(res.data);
  }

  async decideClaim(
    id: string,
    input: DecideClaimInput,
  ): Promise<ClaimAdminDto> {
    const res = await Api.post<unknown>(
      `/admin/claims/${encodeURIComponent(id)}/decide`,
      decideClaimInputSchema.parse(input),
    );
    return claimAdminWireSchema.parse(res.data);
  }

  // ── Inspections (admin has booking visibility, ADR-0011) ──────────────────

  async listBookingInspections(bookingId: string): Promise<InspectionDto[]> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/inspections`,
    );
    return inspectionListWireSchema.parse(res.data);
  }

  // ── Car registration documents (ADR-0009) ─────────────────────────────────

  /** ASSUMED route (see the class header): the applicant's fleet. */
  async listAgencyCars(agencyId: string): Promise<AgencyCar[]> {
    const res = await Api.get<unknown>(
      `/admin/agencies/${encodeURIComponent(agencyId)}/cars`,
    );
    return agencyCarListWireSchema.parse(res.data);
  }

  async listCarDocuments(carId: string): Promise<CarDocumentAdminDto[]> {
    const res = await Api.get<unknown>(
      `/admin/cars/${encodeURIComponent(carId)}/documents`,
    );
    return carDocumentAdminListWireSchema.parse(res.data);
  }

  /**
   * A car document's bytes (with auth) as a Blob to view. Binary, so there is
   * nothing to validate — the caller object-URLs it.
   */
  async downloadCarDocument(carId: string, docId: string): Promise<Blob> {
    const res = await Api.get<Blob>(
      `/admin/cars/${encodeURIComponent(carId)}/documents/${encodeURIComponent(docId)}`,
      { responseType: "blob" },
    );
    return res.data;
  }

  async verifyCarDocument(
    carId: string,
    docId: string,
  ): Promise<CarDocumentAdminDto> {
    const res = await Api.patch<unknown>(
      `/admin/cars/${encodeURIComponent(carId)}/documents/${encodeURIComponent(docId)}/verify`,
      {},
    );
    return carDocumentAdminWireSchema.parse(res.data);
  }

  async rejectCarDocument(
    carId: string,
    docId: string,
    reason: string,
  ): Promise<CarDocumentAdminDto> {
    const res = await Api.patch<unknown>(
      `/admin/cars/${encodeURIComponent(carId)}/documents/${encodeURIComponent(docId)}/reject`,
      { reason },
    );
    return carDocumentAdminWireSchema.parse(res.data);
  }

  // ── Stripe payout accounts (ADR-0012) ─────────────────────────────────────

  async listPayoutAccounts(
    query: AdminPayoutAccountsQuery = {},
  ): Promise<Paginated<PayoutAccountAdminDto>> {
    const res = await Api.get<unknown>("/admin/payout-accounts", {
      params: adminPayoutAccountsQuerySchema.parse(query),
    });
    return payoutAccountAdminPageWireSchema.parse(res.data);
  }

  /** Stops automatic Stripe payouts for the agency (money accrues in the wallet). */
  async disablePayoutAccount(
    agencyId: string,
    reason: string,
  ): Promise<PayoutAccountAdminDto> {
    const res = await Api.post<unknown>(
      `/admin/payout-accounts/${encodeURIComponent(agencyId)}/disable`,
      { reason },
    );
    return payoutAccountAdminWireSchema.parse(res.data);
  }

  async enablePayoutAccount(
    agencyId: string,
  ): Promise<PayoutAccountAdminDto> {
    const res = await Api.post<unknown>(
      `/admin/payout-accounts/${encodeURIComponent(agencyId)}/enable`,
      {},
    );
    return payoutAccountAdminWireSchema.parse(res.data);
  }

  // ── Console dashboards ────────────────────────────────────────────────────

  /** Platform-wide snapshot (agencies + bookings + revenue + queues). */
  async getOverview(): Promise<AdminOverview> {
    const res = await Api.get<unknown>("/admin/overview");
    return adminOverviewWireSchema.parse(res.data);
  }

  /** Agencies directory across ALL statuses (paginated). */
  async listAgencies(
    query: AdminAgenciesQuery = {},
  ): Promise<Paginated<AdminAgencyRow>> {
    const res = await Api.get<unknown>("/admin/agencies", {
      params: adminAgenciesQuerySchema.parse(query),
    });
    return adminAgencyPageWireSchema.parse(res.data);
  }

  /** Platform-wide orders (bookings) by day/state (paginated). */
  async listBookings(
    query: AdminBookingsQuery = {},
  ): Promise<Paginated<AdminBookingRow>> {
    const res = await Api.get<unknown>("/admin/bookings", {
      params: adminBookingsQuerySchema.parse(query),
    });
    return adminBookingPageWireSchema.parse(res.data);
  }

  /** Platform earnings — wallet balance + date-filtered ledger (newest first). */
  async getRevenue(query: AdminRevenueQuery = {}): Promise<AdminRevenue> {
    const res = await Api.get<unknown>("/admin/revenue", {
      params: adminRevenueQuerySchema.parse(query),
    });
    return adminRevenueWireSchema.parse(res.data);
  }

  // ── Catalog (read = public endpoints; write = admin-gated POSTs) ──────────

  async listMakes(): Promise<CatalogMake[]> {
    const res = await Api.get<unknown>("/catalog/makes");
    return catalogMakeListWireSchema.parse(res.data);
  }

  async listModels(makeId: string): Promise<CatalogModel[]> {
    const res = await Api.get<unknown>(
      `/catalog/makes/${encodeURIComponent(makeId)}/models`,
    );
    return catalogModelListWireSchema.parse(res.data);
  }

  async createMake(name: string): Promise<CatalogMake> {
    const res = await Api.post<unknown>("/catalog/makes", { name });
    return catalogMakeWireSchema.parse(res.data);
  }

  async createModel(makeId: string, name: string): Promise<CatalogModel> {
    const res = await Api.post<unknown>(
      `/catalog/makes/${encodeURIComponent(makeId)}/models`,
      { name },
    );
    return catalogModelWireSchema.parse(res.data);
  }

  // ── Geo (read = public; city creation + tax rate = admin-gated) ───────────

  async listCountries(): Promise<Country[]> {
    const res = await Api.get<unknown>("/geo/countries");
    return countryListWireSchema.parse(res.data);
  }

  async listCities(): Promise<City[]> {
    const res = await Api.get<unknown>("/geo/cities");
    return cityListWireSchema.parse(res.data);
  }

  async createCity(input: CreateCityInput): Promise<City> {
    const res = await Api.post<unknown>(
      "/geo/cities",
      createCityInputSchema.parse(input),
    );
    return cityWireSchema.parse(res.data);
  }

  /**
   * Set (or clear, with `null`) the country's own tax rate. The rate that
   * reaches a booking is resolved from the CAR's country, so this is what
   * makes a Miami rental charge Florida's rate and a Santiago one ITBIS.
   * Existing bookings snapshot their rate and never move.
   */
  async updateCountryTaxRate(
    countryId: string,
    taxRatePct: number | null,
  ): Promise<Country> {
    const res = await Api.patch<unknown>(
      `/geo/countries/${encodeURIComponent(countryId)}`,
      { taxRatePct },
    );
    return countryWireSchema.parse(res.data);
  }

  // ── Agency applications / KYC review (ADR-0004) ───────────────────────────

  async listApplications(status?: string): Promise<AgencyApplication[]> {
    const res = await Api.get<unknown>("/agencies/applications", {
      params: { status },
    });
    return agencyApplicationListWireSchema.parse(res.data);
  }

  async getApplication(id: string): Promise<AgencyApplication> {
    const res = await Api.get<unknown>(
      `/agencies/applications/${encodeURIComponent(id)}`,
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  async verifyApplication(id: string): Promise<AgencyApplication> {
    const res = await Api.patch<unknown>(
      `/agencies/applications/${encodeURIComponent(id)}/verify`,
      {},
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  /**
   * Ask a PENDING applicant for something, without deciding. The note is
   * the whole message they receive, so the server floors it at 10
   * characters: "upload again" names no document and cannot be acted on.
   */
  async requestApplicationDocuments(
    id: string,
    note: string,
  ): Promise<AgencyApplication> {
    const res = await Api.patch<unknown>(
      `/agencies/applications/${encodeURIComponent(id)}/request-documents`,
      { note },
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  async rejectApplication(
    id: string,
    reason: string,
  ): Promise<AgencyApplication> {
    const res = await Api.patch<unknown>(
      `/agencies/applications/${encodeURIComponent(id)}/reject`,
      { reason },
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  /** A KYC document's bytes (with auth) as a Blob to view/download. */
  async downloadDocument(agencyId: string, docId: string): Promise<Blob> {
    const res = await Api.get<Blob>(
      `/agencies/applications/${encodeURIComponent(agencyId)}/documents/${encodeURIComponent(docId)}`,
      { responseType: "blob" },
    );
    return res.data;
  }

  // ── Payouts queue ─────────────────────────────────────────────────────────

  async listPayouts(
    query: AdminPayoutsQuery = {},
  ): Promise<Paginated<AdminPayout>> {
    const res = await Api.get<unknown>("/admin/payouts", {
      params: adminPayoutsQuerySchema.parse(query),
    });
    return adminPayoutPageWireSchema.parse(res.data);
  }

  /** Mark a requested payout as wired, recording the bank transfer reference. */
  async payPayout(id: string, reference: string): Promise<AdminPayout> {
    const res = await Api.post<unknown>(
      `/admin/payouts/${encodeURIComponent(id)}/pay`,
      { reference },
    );
    return adminPayoutWireSchema.parse(res.data);
  }

  async rejectPayout(id: string, reason: string): Promise<AdminPayout> {
    const res = await Api.post<unknown>(
      `/admin/payouts/${encodeURIComponent(id)}/reject`,
      { reason },
    );
    return adminPayoutWireSchema.parse(res.data);
  }

  /**
   * Re-submit a FAILED Stripe payout: a new payout row + wallet debit is
   * created; the failed one stays as history.
   */
  async retryPayout(id: string): Promise<AdminPayout> {
    const res = await Api.post<unknown>(
      `/admin/payouts/${encodeURIComponent(id)}/retry`,
      {},
    );
    return adminPayoutWireSchema.parse(res.data);
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUsersQuery = {}): Promise<Paginated<AdminUser>> {
    const parsed = adminUsersQuerySchema.parse(query);
    const res = await Api.get<unknown>("/admin/users", {
      params: {
        q: parsed.q || undefined,
        role: parsed.role || undefined,
        status: parsed.status || undefined,
        page: parsed.page,
        pageSize: parsed.pageSize,
      },
    });
    return adminUserPageWireSchema.parse(res.data);
  }

  /** Suspend (revokes every session) or reactivate an account. */
  async setUserStatus(
    id: string,
    status: AdminUserStatusTarget,
    reason?: string,
  ): Promise<AdminUser> {
    const res = await Api.patch<unknown>(
      `/admin/users/${encodeURIComponent(id)}/status`,
      { status: adminUserStatusTargetSchema.parse(status), reason },
    );
    return adminUserWireSchema.parse(res.data);
  }

  // ── Agency oversight ──────────────────────────────────────────────────────

  /** Suspend a verified agency (with a reason) or reinstate a suspended one. */
  async setAgencyStatus(
    id: string,
    status: AdminAgencyStatusTarget,
    reason?: string,
  ): Promise<AgencyApplication> {
    const res = await Api.patch<unknown>(
      `/admin/agencies/${encodeURIComponent(id)}/status`,
      { status: adminAgencyStatusTargetSchema.parse(status), reason },
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  // ── Booking oversight ─────────────────────────────────────────────────────

  async getBooking(id: string): Promise<AdminBookingDetail> {
    const res = await Api.get<unknown>(
      `/admin/bookings/${encodeURIComponent(id)}`,
    );
    return adminBookingDetailWireSchema.parse(res.data);
  }

  /** Cancel on behalf of the platform — the customer is refunded in full. */
  async cancelBooking(id: string, reason: string): Promise<BookingDetail> {
    const res = await Api.post<unknown>(
      `/admin/bookings/${encodeURIComponent(id)}/cancel`,
      { reason },
    );
    return bookingDetailWireSchema.parse(res.data);
  }

  // ── Integrations (encrypted third-party secrets) ──────────────────────────
  //
  // SECURITY: the server NEVER returns a plaintext secret — a secret setting
  // only ever exposes a masked `preview`. This client therefore never assumes
  // it can read back a value it just wrote; the PUT response is a fresh
  // masked view, same as the GET. Values typed in the console travel once, in
  // the PUT body, and are never persisted or logged client-side.

  async listIntegrations(): Promise<IntegrationsView> {
    const res = await Api.get<unknown>("/admin/integrations");
    return integrationsViewWireSchema.parse(res.data);
  }

  /** Set/replace a setting's DB override. Returns a fresh masked view. */
  async setIntegration(key: string, value: string): Promise<SettingView> {
    const res = await Api.put<unknown>(
      `/admin/integrations/${encodeURIComponent(key)}`,
      { value },
    );
    return settingViewWireSchema.parse(res.data);
  }

  /** Clear the DB override so the env fallback resumes (204 No Content). */
  async clearIntegration(key: string): Promise<void> {
    await Api.delete(`/admin/integrations/${encodeURIComponent(key)}`);
  }

  // ── Invites ───────────────────────────────────────────────────────────────
  //
  // The RAW token only ever travels in the emailed link's query and the
  // accept body; the server stores only its sha256 hash. This client never
  // persists or logs the raw token or the chosen password.

  async createInvite(input: CreateInviteInput): Promise<CreatedInvite> {
    const res = await Api.post<unknown>(
      "/admin/invites",
      createInviteInputSchema.parse(input),
    );
    return createdInviteWireSchema.parse(res.data);
  }

  async listInvites(): Promise<AdminInvite[]> {
    const res = await Api.get<unknown>("/admin/invites");
    return adminInviteListWireSchema.parse(res.data);
  }

  async revokeInvite(id: string): Promise<void> {
    await Api.delete(`/admin/invites/${encodeURIComponent(id)}`);
  }

  /** Public, token-gated: who the emailed link belongs to (404/410 if stale). */
  async verifyInvite(token: string): Promise<VerifiedInvite> {
    const res = await Api.get<unknown>("/admin/invites/verify", {
      params: { token },
    });
    return verifiedInviteWireSchema.parse(res.data);
  }

  /** Public, token-gated: set the password and create the account. */
  async acceptInvite(input: AcceptInviteInput): Promise<void> {
    await Api.post("/admin/invites/accept", acceptInviteInputSchema.parse(input));
  }
}

export const adminService = new AdminService();
