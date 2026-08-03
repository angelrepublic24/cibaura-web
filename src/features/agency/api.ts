import { Api } from "@/shared/api/client";
import type {
  Agency,
  AgencyCar,
  Booking,
  Branch,
  CarCategory,
  CarColor,
  CarStatus,
  DeliveryZoneFull,
  FuelType,
  LedgerEntry,
  OccupancyEntry,
  Paginated,
  Transmission,
  WalletAccount,
} from "@/shared/types/domain";
import type {
  AgencyPermission,
  AgencySession,
  StaffMember,
} from "./rbac";

/**
 * Agency dashboard API module (agency_owner / agency_staff only).
 *
 * Expected backend endpoints (integrator: align with backend routes).
 * All routes are scoped to the CALLER's agency via RBAC — no agencyId in
 * the path:
 *  - GET    /agency/me                              -> Agency
 *  - GET    /agency/fleet?status&page               -> Paginated<AgencyCar> (includes private plate)
 *  - POST   /agency/fleet  CreateCarInput           -> AgencyCar (status=draft)
 *  - PATCH  /agency/fleet/:carId  Partial<CreateCarInput> & { status? } -> AgencyCar
 *  - GET    /agency/calendar?carId&month=YYYY-MM    -> OccupancyEntry[] (bookings + manual blocks)
 *  - POST   /agency/manual-blocks { carId, from, to, note? } -> OccupancyEntry
 *      (offline/phone/WhatsApp rentals — inserted into CarOccupancy, so the
 *       DB exclusion constraint rejects overlaps: expect 409 on conflict)
 *  - DELETE /agency/manual-blocks/:id               -> 204
 *  - GET    /agency/requests?state&page             -> Paginated<Booking> (inbox; default state=requested)
 *  - PATCH  /agency/requests/:bookingId/accept      -> Booking
 *      (server: state change + occupancy insert + payment capture in ONE
 *       transaction; may fail with reason "no_longer_available")
 *  - PATCH  /agency/requests/:bookingId/reject { reason } -> Booking
 *  - GET    /agency/branches                        -> Branch[]
 *  - POST   /agency/branches CreateBranchInput      -> Branch
 *  - PATCH  /agency/branches/:branchId  UpdateBranchInput -> Branch (incl. isActive)
 *  - GET    /agency/branches/:branchId/zones        -> DeliveryZoneFull[]
 *  - POST   /agency/branches/:branchId/zones { name, feeCents } -> DeliveryZoneFull
 *  - DELETE /agency/zones/:zoneId                   -> 204
 *  - GET    /agency/wallet                          -> { account: WalletAccount, entries: LedgerEntry[] }
 */

export const agencyKeys = {
  all: ["agency"] as const,
  me: () => ["agency", "me"] as const,
  fleet: (filters: { status?: CarStatus; page?: number } = {}) =>
    ["agency", "fleet", filters] as const,
  calendar: (carId: string | null, month: string) =>
    ["agency", "calendar", carId, month] as const,
  requests: (filters: { state?: string; page?: number } = {}) =>
    ["agency", "requests", filters] as const,
  branches: () => ["agency", "branches"] as const,
  zones: (branchId: string) => ["agency", "zones", branchId] as const,
  wallet: () => ["agency", "wallet"] as const,
  session: () => ["agency", "session"] as const,
  staff: () => ["agency", "staff"] as const,
};

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: "manager" | "sales" | "custom";
  permissions?: AgencyPermission[];
  branchScopeMode: "all" | "branches";
  branchIds?: string[];
}

export interface UpdateStaffInput {
  role?: "manager" | "sales" | "custom";
  permissions?: AgencyPermission[];
  branchScopeMode?: "all" | "branches";
  branchIds?: string[];
  isActive?: boolean;
}

export interface CreateCarInput {
  branchId: string;
  makeId: string; // from catalog — never free text
  modelId: string; // from catalog — dependent on makeId
  year: number;
  color: CarColor;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  category: CarCategory;
  plate: string; // private — agency-only
  pricePerDayCents: number; // integer cents
  photos?: string[];
}

export interface CreateBranchInput {
  cityId: string;
  name: string;
  address: string;
  phone?: string;
  /** `{ day: "HH:MM-HH:MM" }` map; omitted in the v1 branches form. */
  hours?: Record<string, string>;
  // ── Door-to-door delivery config ──
  /** Branch coordinates (the delivery origin) + fee params. */
  lat?: number;
  lng?: number;
  deliveryEnabled?: boolean;
  deliveryBaseFeeCents?: number;
  deliveryPerKmCents?: number;
  deliveryMaxKm?: number;
}

/** Partial branch edit + the `isActive` toggle (backend UpdateBranchDto). */
export type UpdateBranchInput = Partial<CreateBranchInput> & {
  isActive?: boolean;
};

export interface ManualBlockInput {
  carId: string;
  from: string; // ISO date
  to: string; // ISO date, half-open [from, to)
  note?: string;
}

export const AgencyApi = {
  async me(): Promise<Agency> {
    const res = await Api.get("/agency/me");
    return res.data;
  },

  // ------------------------------------------------------------- fleet

  async fleet(
    filters: { status?: CarStatus; page?: number } = {},
  ): Promise<Paginated<AgencyCar>> {
    const res = await Api.get("/agency/fleet", { params: filters });
    return res.data;
  },

  async createCar(input: CreateCarInput): Promise<AgencyCar> {
    const res = await Api.post("/agency/fleet", input);
    return res.data;
  },

  async updateCar(
    carId: string,
    input: Partial<CreateCarInput> & { status?: CarStatus },
  ): Promise<AgencyCar> {
    const res = await Api.patch(`/agency/fleet/${carId}`, input);
    return res.data;
  },

  // ---------------------------------------------------------- calendar

  async calendar(
    carId: string | null,
    month: string,
  ): Promise<OccupancyEntry[]> {
    const res = await Api.get("/agency/calendar", {
      params: { carId: carId ?? undefined, month },
    });
    return res.data;
  },

  async createManualBlock(input: ManualBlockInput): Promise<OccupancyEntry> {
    const res = await Api.post("/agency/manual-blocks", input);
    return res.data;
  },

  async deleteManualBlock(blockId: string): Promise<void> {
    await Api.delete(`/agency/manual-blocks/${blockId}`);
  },

  // ---------------------------------------------------------- requests

  async requests(
    filters: { state?: string; page?: number } = {},
  ): Promise<Paginated<Booking>> {
    const res = await Api.get("/agency/requests", { params: filters });
    return res.data;
  },

  async acceptRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/accept`, {});
    return res.data;
  },

  async rejectRequest(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/reject`, {
      reason,
    });
    return res.data;
  },

  // ── Walk-in (counter) sale ──

  async walkInBooking(input: {
    carId: string;
    customerEmail: string;
    /** Used only when the email has no account yet (new guest customer). */
    customerName?: string;
    customerPhone?: string;
    start: string;
    end: string;
    pickupType?: "branch_pickup" | "delivery";
    deliveryAddress?: string;
    deliveryLat?: number;
    deliveryLng?: number;
    deliveryReference?: string;
  }): Promise<Booking> {
    const res = await Api.post("/agency/walk-in-bookings", input);
    return res.data;
  },

  // -------------------------------------------------- branches & zones

  async branches(): Promise<Branch[]> {
    const res = await Api.get("/agency/branches");
    return res.data;
  },

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    const res = await Api.post("/agency/branches", input);
    return res.data;
  },

  async updateBranch(
    branchId: string,
    input: UpdateBranchInput,
  ): Promise<Branch> {
    const res = await Api.patch(`/agency/branches/${branchId}`, input);
    return res.data;
  },

  async zones(branchId: string): Promise<DeliveryZoneFull[]> {
    const res = await Api.get(`/agency/branches/${branchId}/zones`);
    return res.data;
  },

  async createZone(
    branchId: string,
    input: { name: string; feeCents: number },
  ): Promise<DeliveryZoneFull> {
    const res = await Api.post(`/agency/branches/${branchId}/zones`, input);
    return res.data;
  },

  async deleteZone(zoneId: string): Promise<void> {
    await Api.delete(`/agency/zones/${zoneId}`);
  },

  // ------------------------------------------------------------ wallet

  async wallet(): Promise<{ account: WalletAccount; entries: LedgerEntry[] }> {
    const res = await Api.get("/agency/wallet");
    return res.data;
  },

  // ------------------------------------------------- session & staff (RBAC)

  async session(): Promise<AgencySession> {
    const res = await Api.get("/agency/session");
    return res.data;
  },

  async staff(): Promise<StaffMember[]> {
    const res = await Api.get("/agency/staff");
    return res.data;
  },

  async createStaff(input: CreateStaffInput): Promise<StaffMember> {
    const res = await Api.post("/agency/staff", input);
    return res.data;
  },

  async updateStaff(
    userId: string,
    input: UpdateStaffInput,
  ): Promise<StaffMember> {
    const res = await Api.patch(`/agency/staff/${userId}`, input);
    return res.data;
  },

  async removeStaff(userId: string): Promise<void> {
    await Api.delete(`/agency/staff/${userId}`);
  },
};
