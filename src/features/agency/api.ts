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
 *  - GET    /agency/requests?state&page             -> Paginated<AgencyRequest>
 *      (inbox; default state=requested; each row carries `expiresAt` — the
 *       auto-expiry deadline while `requested`, null in any other state)
 *  - PATCH  /agency/requests/:bookingId/accept      -> Booking
 *      (server: state change + occupancy insert + payment capture in ONE
 *       transaction; may fail with reason "no_longer_available")
 *  - PATCH  /agency/requests/:bookingId/reject { reason } -> Booking
 *  - PATCH  /agency/requests/:bookingId/pickup      -> Booking (accepted→active)
 *  - PATCH  /agency/requests/:bookingId/return      -> Booking (active→returned)
 *  - PATCH  /agency/requests/:bookingId/settle      -> Booking (returned→settled;
 *       releases the agency payout to the wallet)
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
  carPhotos: (carId: string) => ["agency", "car-photos", carId] as const,
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

/**
 * One gallery photo as the managing agency sees it. `url` is an API path
 * (`/cars/photos/:id`) — resolve with `resolveCarPhotoUrl` before rendering.
 * `position` 0 is the cover photo.
 */
export interface CarPhoto {
  id: string;
  url: string;
  position: number;
}

/** Client-side mirror of the backend upload caps (server enforces them). */
export const MAX_CAR_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB per photo
export const MAX_PHOTOS_PER_CAR = 10;
export const ALLOWED_CAR_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

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

/**
 * One agency-inbox row: the standard booking plus `expiresAt` — the ISO
 * instant the request auto-expires (requestedAt + the platform's configured
 * expiry hours). Null once the booking left the `requested` state.
 */
export type AgencyRequest = Booking & { expiresAt: string | null };

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

  // -------------------------------------------------------- car photos
  // Backend: /agency/fleet/:carId/photos (owning agency + FLEET_WRITE);
  // the public read is GET /cars/photos/:photoId (streamed, cached).

  async carPhotos(carId: string): Promise<CarPhoto[]> {
    const res = await Api.get(`/agency/fleet/${carId}/photos`);
    return res.data;
  },

  /**
   * Upload ONE photo (multipart field `files`). One request per file keeps
   * per-file progress + per-file errors honest in the UI; the backend caps
   * the gallery at MAX_PHOTOS_PER_CAR either way. Returns the full updated
   * gallery.
   */
  async uploadCarPhoto(
    carId: string,
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<CarPhoto[]> {
    const form = new FormData();
    form.append("files", file);
    const res = await Api.post(`/agency/fleet/${carId}/photos`, form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return res.data;
  },

  async deleteCarPhoto(carId: string, photoId: string): Promise<void> {
    await Api.delete(`/agency/fleet/${carId}/photos/${photoId}`);
  },

  /** Full-set reorder — send every photo id; index 0 becomes the cover. */
  async reorderCarPhotos(
    carId: string,
    photoIds: string[],
  ): Promise<CarPhoto[]> {
    const res = await Api.patch(`/agency/fleet/${carId}/photos/order`, {
      photoIds,
    });
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
  ): Promise<Paginated<AgencyRequest>> {
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

  // ── Lifecycle after accept (pickup → return → settle) ──

  /** Customer collected the car: accepted → active (stamps pickedUpAt). */
  async pickupRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/pickup`, {});
    return res.data;
  },

  /** Car is back at the branch: active → returned. */
  async returnRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/return`, {});
    return res.data;
  },

  /** Close the money-path: returned → settled (payout hits the wallet). */
  async settleRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/settle`, {});
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
