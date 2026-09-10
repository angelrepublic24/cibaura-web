import { Api } from "@/shared/api/client";
import type {
  AgencyKind,
  AgencyVerificationStatus,
  BookingDetail,
  BookingState,
  CatalogMake,
  CatalogModel,
  City,
  Country,
  Paginated,
  Payout,
  PayoutBankDetails,
  PlatformConfig,
} from "@/shared/types/domain";
import type { AgencyApplication } from "@/features/agencies/api";

// ── Ops: payouts, users, agency status, booking oversight ────────────────────

/** One row of GET /admin/payouts (wire `AdminPayoutDto`). */
export interface AdminPayout extends Payout {
  agencyName: string;
  agencySlug: string;
  /** Where to wire the money — null when the agency removed its account. */
  bankDetails: PayoutBankDetails | null;
  requestedByName: string | null;
  decidedByName: string | null;
}

/** Query params for the payouts queue. */
export interface AdminPayoutsQuery {
  status?: string;
  page?: number;
  pageSize?: number;
}

/** One row of GET /admin/users (wire `AdminUserDto`). */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  roles: string[];
  agencyId: string | null;
  /** `active | suspended | deleted` */
  status: string;
  isGuest: boolean;
  createdAt: string;
}

/** Query params for the users directory (ILIKE on email/name). */
export interface AdminUsersQuery {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** PATCH /admin/users/:id/status body. */
export type AdminUserStatusTarget = "active" | "suspended";

/** PATCH /admin/agencies/:id/status body (`suspended` ⇄ `verified`). */
export type AdminAgencyStatusTarget = "suspended" | "verified";

/**
 * GET /admin/bookings/:id (wire `AdminBookingDetailDto`): the agency-viewer
 * booking (customer + agreement, no client secret) plus the payment's
 * lifecycle status, or null when no payment row exists (walk-ins).
 */
export interface AdminBookingDetail extends BookingDetail {
  paymentStatus: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Console contract types (mirror the backend /admin console DTOs 1:1).
// All money is INTEGER CENTS; dates are ISO strings; ranges half-open.
// ─────────────────────────────────────────────────────────────────────────

/** Per-state booking counts (all eight lifecycle states). */
export interface AdminBookingStateCounts {
  requested: number;
  accepted: number;
  active: number;
  returned: number;
  settled: number;
  rejected: number;
  cancelled: number;
  expired: number;
}

/** GET /admin/overview — platform-wide dashboard snapshot. */
export interface AdminOverview {
  agencies: {
    total: number;
    verified: number;
    pending: number;
    rejected: number;
  };
  bookings: {
    today: number;
    thisMonth: number;
    active: number;
    byState: AdminBookingStateCounts;
  };
  revenue: {
    platformBalanceCents: number;
    currency: string;
    thisMonthCents: number;
    allTimeCents: number;
  };
  pending: {
    applications: number;
    verifications: number;
  };
}

/** One row of GET /admin/agencies (directory across ALL statuses). */
export interface AdminAgencyRow {
  id: string;
  name: string;
  slug: string;
  /** `business | individual` (ADR-0009). */
  kind: AgencyKind;
  verificationStatus: AgencyVerificationStatus;
  cities: string[];
  branchCount: number;
  carCount: number;
  ratingAvg: number;
  reviewCount: number;
  createdAt: string;
}

/** One row of GET /admin/bookings (platform-wide orders). */
export interface AdminBookingRow {
  id: string;
  agencyName: string;
  customerName: string;
  car: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, exclusive
  state: BookingState;
  totalCents: number;
  commissionCents: number;
  currency: string;
  createdAt: string;
}

/** One platform-wallet ledger entry in GET /admin/revenue. */
export interface AdminRevenueEntry {
  id: string;
  amountCents: number; // signed: credit > 0, debit < 0
  description: string;
  bookingId?: string;
  createdAt: string;
}

/** GET /admin/revenue — platform earnings + date-filtered ledger. */
export interface AdminRevenue {
  balanceCents: number;
  currency: string;
  thisMonthCents: number;
  allTimeCents: number;
  /** Newest first, date-filtered. */
  entries: AdminRevenueEntry[];
}

/** Query params for the paginated agencies directory. */
export interface AdminAgenciesQuery {
  status?: AgencyVerificationStatus;
  page?: number;
  pageSize?: number;
}

/** Query params for the paginated platform orders list. */
export interface AdminBookingsQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD, exclusive
  state?: BookingState;
  page?: number;
  pageSize?: number;
}

/** Query params for the platform revenue view. */
export interface AdminRevenueQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD, exclusive
}

/**
 * Platform admin API module (platform_admin only).
 *
 * Real backend routes (verified against the controllers):
 *  - GET   /admin/config                    -> { commissionPct }
 *  - PATCH /admin/config/commission { commissionPct } -> { commissionPct }
 *      (commission is SNAPSHOTTED into each booking at request time —
 *       changing it never rewrites existing bookings)
 *  - POST  /catalog/makes { name }                 -> CatalogMake  (admin)
 *  - POST  /catalog/makes/:makeId/models { name }  -> CatalogModel (admin)
 *
 * Read views reuse the PUBLIC catalog/geo endpoints (same data the search
 * facets use): GET /catalog/makes, /catalog/makes/:id/models, /geo/countries,
 * /geo/cities.
 *
 * Ops routes (all platform_admin):
 *  - GET   /admin/payouts?status&page&pageSize     -> Paginated<AdminPayout>
 *  - POST  /admin/payouts/:id/pay { reference }    -> AdminPayout
 *      (ONE transaction: debits the agency wallet + marks paid;
 *       409 PAYOUT_NOT_PENDING / INSUFFICIENT_BALANCE)
 *  - POST  /admin/payouts/:id/reject { reason }    -> AdminPayout (409 PAYOUT_NOT_PENDING)
 *  - GET   /admin/users?q&role&status&page&pageSize -> Paginated<AdminUser>
 *  - PATCH /admin/users/:id/status { status, reason? } -> AdminUser
 *      (400 when targeting yourself or another platform_admin)
 *  - PATCH /admin/agencies/:id/status { status, reason? } -> AgencyApplication
 *      (409 while the agency is pending/rejected — use verify/reject there)
 *  - GET   /admin/bookings/:id                     -> AdminBookingDetail
 *  - POST  /admin/bookings/:id/cancel { reason }   -> BookingDetail (agency viewer;
 *       requested|accepted → cancelled, active → cancelled mid-rental, else 409)
 */

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
};

export const AdminApi = {
  async getConfig(): Promise<PlatformConfig> {
    const res = await Api.get("/admin/config");
    return res.data;
  },

  async setCommission(commissionPct: number): Promise<PlatformConfig> {
    const res = await Api.patch("/admin/config/commission", { commissionPct });
    return res.data;
  },

  // ── Console (platform-wide dashboards, all platform_admin-gated) ──────────

  /** Platform-wide dashboard snapshot (agencies + bookings + revenue + queues). */
  async getOverview(): Promise<AdminOverview> {
    const res = await Api.get("/admin/overview");
    return res.data;
  },

  /** Agencies directory across ALL statuses (paginated). */
  async listAgencies(
    query: AdminAgenciesQuery = {},
  ): Promise<Paginated<AdminAgencyRow>> {
    const res = await Api.get("/admin/agencies", {
      params: {
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return res.data;
  },

  /** Platform-wide orders (bookings) by day/state (paginated). */
  async listBookings(
    query: AdminBookingsQuery = {},
  ): Promise<Paginated<AdminBookingRow>> {
    const res = await Api.get("/admin/bookings", {
      params: {
        from: query.from,
        to: query.to,
        state: query.state,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return res.data;
  },

  /** Platform earnings — wallet balance + date-filtered ledger (newest first). */
  async getRevenue(query: AdminRevenueQuery = {}): Promise<AdminRevenue> {
    const res = await Api.get("/admin/revenue", {
      params: { from: query.from, to: query.to },
    });
    return res.data;
  },

  // ── Catalog (read = public endpoints; write = admin-gated POSTs) ──────────

  async listMakes(): Promise<CatalogMake[]> {
    const res = await Api.get("/catalog/makes");
    return res.data;
  },

  async listModels(makeId: string): Promise<CatalogModel[]> {
    const res = await Api.get(`/catalog/makes/${makeId}/models`);
    return res.data;
  },

  async createMake(name: string): Promise<CatalogMake> {
    const res = await Api.post("/catalog/makes", { name });
    return res.data;
  },

  async createModel(makeId: string, name: string): Promise<CatalogModel> {
    const res = await Api.post(`/catalog/makes/${makeId}/models`, { name });
    return res.data;
  },

  // ── Geo (read = public; city creation = admin-gated) ─────────────────────

  async listCountries(): Promise<Country[]> {
    const res = await Api.get("/geo/countries");
    return res.data;
  },

  async listCities(): Promise<City[]> {
    const res = await Api.get("/geo/cities");
    return res.data;
  },

  async createCity(input: {
    countryId: string;
    name: string;
    slug?: string;
  }): Promise<City> {
    const res = await Api.post("/geo/cities", input);
    return res.data;
  },

  // ── Agency applications / KYC review (ADR-0004) ──────────────────────────

  async listApplications(status?: string): Promise<AgencyApplication[]> {
    const res = await Api.get("/agencies/applications", { params: { status } });
    return res.data;
  },

  async getApplication(id: string): Promise<AgencyApplication> {
    const res = await Api.get(`/agencies/applications/${id}`);
    return res.data;
  },

  async verifyApplication(id: string): Promise<AgencyApplication> {
    const res = await Api.patch(`/agencies/applications/${id}/verify`, {});
    return res.data;
  },

  async rejectApplication(
    id: string,
    reason: string,
  ): Promise<AgencyApplication> {
    const res = await Api.patch(`/agencies/applications/${id}/reject`, {
      reason,
    });
    return res.data;
  },

  /** Fetch a document's bytes (with auth) as a Blob to view/download. */
  async downloadDocument(agencyId: string, docId: string): Promise<Blob> {
    const res = await Api.get(
      `/agencies/applications/${agencyId}/documents/${docId}`,
      { responseType: "blob" },
    );
    return res.data;
  },

  // ── Payouts queue ────────────────────────────────────────────────────────

  async listPayouts(
    query: AdminPayoutsQuery = {},
  ): Promise<Paginated<AdminPayout>> {
    const res = await Api.get("/admin/payouts", {
      params: {
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return res.data;
  },

  /** Mark a requested payout as wired, recording the bank transfer reference. */
  async payPayout(id: string, reference: string): Promise<AdminPayout> {
    const res = await Api.post(`/admin/payouts/${id}/pay`, { reference });
    return res.data;
  },

  async rejectPayout(id: string, reason: string): Promise<AdminPayout> {
    const res = await Api.post(`/admin/payouts/${id}/reject`, { reason });
    return res.data;
  },

  // ── Users ────────────────────────────────────────────────────────────────

  async listUsers(query: AdminUsersQuery = {}): Promise<Paginated<AdminUser>> {
    const res = await Api.get("/admin/users", {
      params: {
        q: query.q || undefined,
        role: query.role || undefined,
        status: query.status || undefined,
        page: query.page,
        pageSize: query.pageSize,
      },
    });
    return res.data;
  },

  /** Suspend (revokes every session) or reactivate an account. */
  async setUserStatus(
    id: string,
    status: AdminUserStatusTarget,
    reason?: string,
  ): Promise<AdminUser> {
    const res = await Api.patch(`/admin/users/${id}/status`, {
      status,
      reason,
    });
    return res.data;
  },

  // ── Agency oversight ─────────────────────────────────────────────────────

  /** Suspend a verified agency (with a reason) or reinstate a suspended one. */
  async setAgencyStatus(
    id: string,
    status: AdminAgencyStatusTarget,
    reason?: string,
  ): Promise<AgencyApplication> {
    const res = await Api.patch(`/admin/agencies/${id}/status`, {
      status,
      reason,
    });
    return res.data;
  },

  // ── Booking oversight ────────────────────────────────────────────────────

  async getBooking(id: string): Promise<AdminBookingDetail> {
    const res = await Api.get(`/admin/bookings/${id}`);
    return res.data;
  },

  /** Cancel on behalf of the platform — the customer is refunded in full. */
  async cancelBooking(id: string, reason: string): Promise<BookingDetail> {
    const res = await Api.post(`/admin/bookings/${id}/cancel`, { reason });
    return res.data;
  },
};
