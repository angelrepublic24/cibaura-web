import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminService } from "@/modules/admin/services/admin.service";
import { bookingKeys } from "@/modules/bookings/hooks/bookings.hook";
import { legalKeys } from "@/modules/legal/hooks/legal.hook";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import type { ContractKind, Country } from "@/shared/types/domain";
import type {
  AdminAgenciesQuery,
  AdminAgencyStatusTarget,
  AdminBookingsQuery,
  AdminClaimsQuery,
  AdminPayoutAccountsQuery,
  AdminPayoutsQuery,
  AdminRevenueQuery,
  AdminUserStatusTarget,
  AdminUsersQuery,
  CreateCityInput,
  CreateContractTemplateInput,
  CreateInviteInput,
  DecideClaimInput,
  PlatformConfig,
  PlatformConfigPatch,
  UpdateContractTemplateInput,
} from "@/modules/admin/types/admin.types";

/** Query keys for the admin module (the only cache it owns). */
export const adminKeys = {
  all: ["admin"] as const,
  config: () => ["admin", "config"] as const,
  overview: () => ["admin", "overview"] as const,
  agencies: (query: AdminAgenciesQuery = {}) =>
    ["admin", "agencies", query] as const,
  bookings: (query: AdminBookingsQuery = {}) =>
    ["admin", "bookings", query] as const,
  booking: (id: string) => ["admin", "booking", id] as const,
  payouts: (query: AdminPayoutsQuery = {}) =>
    ["admin", "payouts", query] as const,
  users: (query: AdminUsersQuery = {}) => ["admin", "users", query] as const,
  revenue: (query: AdminRevenueQuery = {}) =>
    ["admin", "revenue", query] as const,
  makes: () => ["admin", "catalog", "makes"] as const,
  models: (makeId: string) => ["admin", "catalog", "models", makeId] as const,
  countries: () => ["admin", "geo", "countries"] as const,
  cities: () => ["admin", "geo", "cities"] as const,
  applications: (status?: string) =>
    ["admin", "applications", status ?? "pending"] as const,
  application: (id: string) => ["admin", "applications", id] as const,
  contractTemplates: (kind?: ContractKind) =>
    ["admin", "contract-templates", kind ?? "all"] as const,
  contractPreview: (id: string) =>
    ["admin", "contract-templates", "preview", id] as const,
  claims: (query: AdminClaimsQuery = {}) => ["admin", "claims", query] as const,
  claim: (id: string) => ["admin", "claim", id] as const,
  bookingInspections: (bookingId: string) =>
    ["admin", "booking", bookingId, "inspections"] as const,
  agencyCars: (agencyId: string) => ["admin", "agency-cars", agencyId] as const,
  carDocuments: (carId: string) => ["admin", "car-documents", carId] as const,
  payoutAccounts: (query: AdminPayoutAccountsQuery = {}) =>
    ["admin", "payout-accounts", query] as const,
  integrations: () => ["admin", "integrations", "list"] as const,
  invites: () => ["admin", "invites", "list"] as const,
  inviteVerify: (token: string) =>
    ["admin", "invites", "verify", token] as const,
};

// ── Platform configuration ──────────────────────────────────────────────────

export function usePlatformConfig(enabled = true) {
  return useQuery({
    queryKey: adminKeys.config(),
    queryFn: () => adminService.getConfig(),
    enabled,
  });
}

/**
 * The response IS the complete stored configuration (the service already
 * refuses one the server did not confirm), so it replaces the cached copy
 * rather than triggering a refetch.
 */
export function useUpdatePlatformConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PlatformConfigPatch) =>
      adminService.updateConfig(patch),
    onSuccess: (config) => {
      qc.setQueryData<PlatformConfig>(adminKeys.config(), config);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.config() });
      // The cancellation figures are republished through GET /legal/current.
      void qc.invalidateQueries({ queryKey: legalKeys.all });
    },
  });
}

// ── Console dashboards ──────────────────────────────────────────────────────

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: () => adminService.getOverview(),
  });
}

export function useAdminAgencies(query: AdminAgenciesQuery = {}) {
  return useQuery({
    queryKey: adminKeys.agencies(query),
    queryFn: () => adminService.listAgencies(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminBookings(query: AdminBookingsQuery = {}) {
  return useQuery({
    queryKey: adminKeys.bookings(query),
    queryFn: () => adminService.listBookings(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminRevenue(query: AdminRevenueQuery = {}) {
  return useQuery({
    queryKey: adminKeys.revenue(query),
    queryFn: () => adminService.getRevenue(query),
    placeholderData: keepPreviousData,
  });
}

/** Suspending or reinstating an agency moves the directory AND the overview. */
export function useSetAgencyStatus(agencyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      status: AdminAgencyStatusTarget;
      reason?: string;
    }) => adminService.setAgencyStatus(agencyId, input.status, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

// ── Users ───────────────────────────────────────────────────────────────────

export function useAdminUsers(query: AdminUsersQuery = {}) {
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => adminService.listUsers(query),
    placeholderData: keepPreviousData,
  });
}

/** Suspending revokes every session the user holds. */
export function useSetUserStatus(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: AdminUserStatusTarget; reason?: string }) =>
      adminService.setUserStatus(userId, input.status, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

// ── Payouts queue ───────────────────────────────────────────────────────────

export function useAdminPayouts(query: AdminPayoutsQuery = {}) {
  return useQuery({
    queryKey: adminKeys.payouts(query),
    queryFn: () => adminService.listPayouts(query),
    placeholderData: keepPreviousData,
  });
}

/**
 * Paying, rejecting or retrying a payout all move the queue and the
 * platform's own figures, so each refreshes the whole admin subtree.
 */
export function usePayPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reference: string }) =>
      adminService.payPayout(input.id, input.reference),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRejectPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      adminService.rejectPayout(input.id, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRetryPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.retryPayout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

// ── Stripe payout accounts (ADR-0012) ───────────────────────────────────────

export function useAdminPayoutAccounts(query: AdminPayoutAccountsQuery) {
  return useQuery({
    queryKey: adminKeys.payoutAccounts(query),
    queryFn: () => adminService.listPayoutAccounts(query),
    placeholderData: keepPreviousData,
  });
}

export function useDisablePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { agencyId: string; reason: string }) =>
      adminService.disablePayoutAccount(input.agencyId, input.reason),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "payout-accounts"] }),
  });
}

export function useEnablePayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agencyId: string) =>
      adminService.enablePayoutAccount(agencyId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "payout-accounts"] }),
  });
}

// ── Booking oversight ───────────────────────────────────────────────────────

export function useAdminBooking(id: string) {
  return useQuery({
    queryKey: adminKeys.booking(id),
    queryFn: () => adminService.getBooking(id),
    enabled: !!id,
  });
}

/**
 * Cancelling on behalf of the platform refunds the customer in full. The
 * booking also has a copy under the BOOKINGS key (what the customer and the
 * agency read), so that one is refreshed too.
 */
export function useAdminCancelBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => adminService.cancelBooking(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.all });
      void qc.invalidateQueries({ queryKey: bookingKeys.detail(id) });
    },
  });
}

// ── Contract templates (ADR-0010) ───────────────────────────────────────────

export function useContractTemplates(kind: ContractKind) {
  return useQuery({
    queryKey: adminKeys.contractTemplates(kind),
    queryFn: () => adminService.listContractTemplates(kind),
  });
}

/** Server preview of a SAVED template; `enabled` gates it until one is selected. */
export function useContractPreview(id: string | null) {
  return useQuery({
    queryKey: adminKeys.contractPreview(id ?? ""),
    queryFn: () => adminService.previewContractTemplate(id ?? ""),
    enabled: !!id,
  });
}

export function useCreateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractTemplateInput) =>
      adminService.createContractTemplate(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "contract-templates"] }),
  });
}

export function useUpdateContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; values: UpdateContractTemplateInput }) =>
      adminService.updateContractTemplate(input.id, input.values),
    onSuccess: (saved) => {
      // The list AND this template's server-rendered preview are now stale.
      void qc.invalidateQueries({ queryKey: ["admin", "contract-templates"] });
      void qc.invalidateQueries({
        queryKey: adminKeys.contractPreview(saved.id),
      });
    },
  });
}

/**
 * Publishing archives the current version and assigns the next number, so
 * every list and preview of this kind is stale afterwards.
 */
export function usePublishContractTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; requireResign?: boolean }) =>
      adminService.publishContractTemplate(input.id, input.requireResign),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["admin", "contract-templates"] }),
  });
}

/**
 * Open a signed document's PDF. The link is short-lived and minted on click
 * — never cached, or the next click gets a dead URL.
 */
export function useOpenContractDocumentPdf(documentId: string) {
  return useOpenSignedUrl(() => adminService.contractDocumentPdf(documentId));
}

// ── Damage claims (ADR-0013) ────────────────────────────────────────────────

export function useAdminClaims(query: AdminClaimsQuery) {
  return useQuery({
    queryKey: adminKeys.claims(query),
    queryFn: () => adminService.listClaims(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminClaim(id: string) {
  return useQuery({
    queryKey: adminKeys.claim(id),
    queryFn: () => adminService.getClaim(id),
    enabled: !!id,
  });
}

/**
 * The decision captures from the held deposit, so the claim, the queue and
 * the platform's own figures all move together.
 */
export function useDecideClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DecideClaimInput) =>
      adminService.decideClaim(id, input),
    onSuccess: (decided) => {
      // The response IS the decided claim; the queue and the booking it was
      // filed against move with it.
      qc.setQueryData(adminKeys.claim(id), decided);
      void qc.invalidateQueries({ queryKey: ["admin", "claims"] });
      void qc.invalidateQueries({
        queryKey: adminKeys.booking(decided.bookingId),
      });
    },
  });
}

/** Inspections with signed media URLs; the links expire, so never cache long. */
export function useBookingInspections(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.bookingInspections(bookingId),
    queryFn: () => adminService.listBookingInspections(bookingId),
    enabled: enabled && !!bookingId,
    staleTime: 60_000,
  });
}

// ── Car registration documents (ADR-0009) ───────────────────────────────────

export function useAgencyCars(agencyId: string) {
  return useQuery({
    queryKey: adminKeys.agencyCars(agencyId),
    queryFn: () => adminService.listAgencyCars(agencyId),
  });
}

export function useCarDocuments(carId: string) {
  return useQuery({
    queryKey: adminKeys.carDocuments(carId),
    queryFn: () => adminService.listCarDocuments(carId),
  });
}

/**
 * Reviewing a registration document decides whether its car may be
 * published, which is why the applicant's whole review subtree is refreshed.
 */
export function useVerifyCarDocument(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) =>
      adminService.verifyCarDocument(carId, docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRejectCarDocument(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { docId: string; reason: string }) =>
      adminService.rejectCarDocument(carId, input.docId, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

/**
 * The document's bytes, fetched with the admin's session so they can be
 * shown. A mutation, not a query: it is a click, the Blob is not cacheable
 * state, and the caller object-URLs what comes back.
 */
export function useDownloadCarDocument(carId: string) {
  return useMutation({
    mutationFn: (docId: string) =>
      adminService.downloadCarDocument(carId, docId),
  });
}

// ── Agency applications / KYC review (ADR-0004) ─────────────────────────────

export function useAdminApplications(status?: string) {
  return useQuery({
    queryKey: adminKeys.applications(status),
    queryFn: () => adminService.listApplications(status),
  });
}

export function useAdminApplication(id: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.application(id),
    queryFn: () => adminService.getApplication(id),
    enabled: enabled && !!id,
  });
}

export function useVerifyApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.verifyApplication(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRequestApplicationDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; note: string }) =>
      adminService.requestApplicationDocuments(input.id, input.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useRejectApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) =>
      adminService.rejectApplication(input.id, input.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

/** A KYC document's bytes — see `useDownloadCarDocument` for why it is one. */
export function useDownloadApplicationDocument() {
  return useMutation({
    mutationFn: (input: { agencyId: string; docId: string }) =>
      adminService.downloadDocument(input.agencyId, input.docId),
  });
}

// ── Catalog & geo ───────────────────────────────────────────────────────────

export function useAdminMakes() {
  return useQuery({
    queryKey: adminKeys.makes(),
    queryFn: () => adminService.listMakes(),
  });
}

export function useAdminModels(makeId: string, enabled = true) {
  return useQuery({
    queryKey: adminKeys.models(makeId),
    queryFn: () => adminService.listModels(makeId),
    enabled: enabled && !!makeId,
  });
}

export function useCreateMake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminService.createMake(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.makes() }),
  });
}

export function useCreateModel(makeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminService.createModel(makeId, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminKeys.models(makeId) }),
  });
}

export function useAdminCountries() {
  return useQuery({
    queryKey: adminKeys.countries(),
    queryFn: () => adminService.listCountries(),
  });
}

export function useAdminCities() {
  return useQuery({
    queryKey: adminKeys.cities(),
    queryFn: () => adminService.listCities(),
  });
}

export function useCreateCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCityInput) => adminService.createCity(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.cities() }),
  });
}

/**
 * A country's own tax rate; `null` hands the decision back to the platform.
 * The server decides what got stored, so its answer replaces that country's
 * row in the cached list instead of triggering a refetch.
 */
export function useUpdateCountryTaxRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { countryId: string; taxRatePct: number | null }) =>
      adminService.updateCountryTaxRate(input.countryId, input.taxRatePct),
    onSuccess: (saved) => {
      qc.setQueryData<Country[]>(adminKeys.countries(), (prev) =>
        prev?.map((c) => (c.id === saved.id ? saved : c)),
      );
    },
  });
}

// ── Integrations ────────────────────────────────────────────────────────────

export function useIntegrations() {
  return useQuery({
    queryKey: adminKeys.integrations(),
    queryFn: () => adminService.listIntegrations(),
  });
}

/**
 * Writing a setting answers with a FRESH MASKED view — a secret is never
 * readable, so the list is refetched rather than patched from the response.
 */
export function useSetIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: string }) =>
      adminService.setIntegration(input.key, input.value),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminKeys.integrations() }),
  });
}

/** Clearing the DB override lets the env fallback resume. */
export function useClearIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => adminService.clearIntegration(key),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminKeys.integrations() }),
  });
}

// ── Invites ─────────────────────────────────────────────────────────────────

export function useAdminInvites() {
  return useQuery({
    queryKey: adminKeys.invites(),
    queryFn: () => adminService.listInvites(),
  });
}

export function useCreateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      adminService.createInvite(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.invites() }),
  });
}

export function useRevokeInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.revokeInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.invites() }),
  });
}

/**
 * Who the emailed link belongs to. Public and token-gated, and a stale or
 * used token is a 404/410 — a verdict, not a transient failure, so it is
 * never retried.
 */
export function useVerifyInvite(token: string) {
  return useQuery({
    queryKey: adminKeys.inviteVerify(token),
    queryFn: () => adminService.verifyInvite(token),
    enabled: !!token,
    retry: false,
  });
}

/** Set the password and create the account (public, token-gated). */
export function useAcceptInvite() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      adminService.acceptInvite(input),
  });
}
