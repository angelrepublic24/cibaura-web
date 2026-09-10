import { Api } from "@/shared/api/client";
import type {
  AgencyCar,
  AgencySettings,
  AgencyWallet,
  Booking,
  BookingDetail,
  Branch,
  CarCategory,
  CarColor,
  CarDocumentDto,
  CarStatus,
  ClaimDto,
  ContractDocumentDto,
  DeliveryZoneFull,
  FuelType,
  HostAgreementStatusDto,
  InspectionDto,
  InspectionMediaDto,
  InspectionMediaUploadDto,
  InspectionType,
  MediaKind,
  MediaLabel,
  OccupancyEntry,
  Paginated,
  Payout,
  PayoutAccountDto,
  PayoutBankDetails,
  RenterLicenseDto,
  SignedUrlDto,
  Transmission,
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
 * the path (the agency itself is read through `GET /agency/session`):
 *  - GET    /agency/fleet?status&page               -> Paginated<AgencyCar> (includes private plate)
 *  - POST   /agency/fleet  CreateCarInput           -> AgencyCar (status=draft)
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
 *  - PATCH  /agency/requests/:bookingId/reject { reason 2..160 } -> Booking
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
 *  - PATCH  /agency/requests/:bookingId/cancel { reason 2..160 } -> Booking
 *      (accepted → cancelled; `bookings:handle`; the customer is refunded 100%)
 *  - POST   /bookings/:bookingId/cancel-active { reason 2..160 } -> Booking
 *      (active → cancelled mid-rental; same permission + full refund)
 *  - GET    /agency/settings                        -> AgencySettings (`agency:settings`)
 *  - PATCH  /agency/settings UpdateAgencySettingsInput -> AgencySettings
 *  - GET    /agency/wallet                          -> AgencyWallet (`wallet:view`)
 *  - GET    /agency/wallet/payouts                  -> Payout[] (`wallet:view`)
 *  - POST   /agency/wallet/payouts { amountCents }  -> Payout (`wallet:withdraw`;
 *       409 INSUFFICIENT_BALANCE / PAYOUT_BANK_DETAILS_MISSING)
 *
 * v1 expansion (spec §4 B6/B7/B11 — coded against the spec, backend pending):
 *  - PATCH  /agency/fleet/:carId UpdateCarInput     -> AgencyCar (`fleet:write`;
 *       status=active gated: 403 HOST_AGREEMENT_REQUIRED / CAR_REGISTRATION_REQUIRED)
 *  - GET    /agency/fleet/:carId/documents          -> CarDocumentDto[] (`fleet:read`)
 *  - POST   /agency/fleet/:carId/documents (multipart file + type) -> CarDocumentDto
 *       (`fleet:write`; replace-by-type, status resets to `pending`)
 *  - GET    /agency/host-agreement                  -> HostAgreementStatusDto (any member)
 *  - POST   /agency/host-agreement/sign SignContractInput -> ContractDocumentDto
 *       (`agency:settings` + owner: 403 OWNER_ONLY, 409 HOST_AGREEMENT_OUTDATED,
 *        409 TEMPLATE_NOT_PUBLISHED, 400 SIGNATURE_REQUIRED)
 *  - GET    /agency/host-agreement/pdf              -> SignedUrlDto
 *  - GET    /agency/payout-account                  -> PayoutAccountDto (`wallet:view`)
 *  - POST   /agency/payout-account/onboarding-link  -> SignedUrlDto (`wallet:withdraw`
 *       + owner: 403 OWNER_ONLY, 409 PAYOUT_RAIL_DISABLED)
 *  - POST   /agency/payout-account/sync             -> PayoutAccountDto (`wallet:view`)
 *
 * v1 expansion — agency operations (spec §4 B8/B9/B10, ADR-0011/0013;
 * coded against the spec, backend pending). Reads need `bookings:read`,
 * actions `bookings:handle`, all branch-scoped:
 *  - GET    /agency/requests/:bookingId/inspections -> InspectionDto[] (signed media URLs)
 *  - POST   /agency/requests/:bookingId/inspections { type } -> 201 InspectionDto (draft;
 *       409 INSPECTION_EXISTS / INSPECTION_WRONG_STATE — checkin needs `accepted`
 *       on/after the pickup day, checkout needs `active`; checkin also starts
 *       the deposit hold)
 *  - PATCH  /agency/inspections/:id { odometerKm?, fuelLevelEighths?, damageNotes?,
 *       damageFlagged? } -> InspectionDto (draft only)
 *  - POST   /agency/inspections/:id/media { kind, label, contentType, sizeBytes,
 *       durationSeconds? } -> 201 InspectionMediaUploadDto (a pending row + a
 *       signed PUT; 400 MEDIA_LIMIT_EXCEEDED / MEDIA_TOO_LARGE / MEDIA_TYPE_UNSUPPORTED)
 *  - POST   /agency/inspections/:id/media/:mediaId/complete -> InspectionMediaDto
 *       (server HEADs the object; 400 MEDIA_TOO_LARGE / MEDIA_TYPE_UNSUPPORTED)
 *  - DELETE /agency/inspections/:id/media/:mediaId  -> 204 (draft only)
 *  - POST   /agency/inspections/:id/submit          -> InspectionDto (`submitted`;
 *       400 INSPECTION_INCOMPLETE, 409 MEDIA_NOT_UPLOADED / DEPOSIT_NOT_HELD /
 *       DEPOSIT_REQUIRES_ACTION / INSPECTION_WRONG_STATE)
 *  - POST   /agency/inspections/:id/customer-absent { reason 2..300 } -> InspectionDto
 *       (`confirmed_absent` + finalize → the booking moves on)
 *  - PATCH  /agency/requests/:bookingId/pickup|return -> Booking (legacy; 409
 *       INSPECTION_REQUIRED for online bookings without a finalized inspection)
 *  - PATCH  /agency/requests/:bookingId/settle      -> Booking (409 DISPUTE_WINDOW_OPEN /
 *       CLAIM_OPEN / SETTLEMENT_ALREADY_FINALIZED)
 *  - GET    /agency/requests/:bookingId/claims      -> ClaimDto[]
 *  - POST   /agency/requests/:bookingId/claims { requestedCents, description 10..4000,
 *       evidenceMediaIds ≤20 } -> 201 ClaimDto (409 DISPUTE_WINDOW_CLOSED / CLAIM_EXISTS,
 *       400 CLAIM_AMOUNT_EXCEEDS_LIMIT)
 *  - POST   /agency/claims/:id/withdraw             -> ClaimDto (409 CLAIM_NOT_OPEN)
 *  - GET    /bookings/:bookingId/renter-license     -> RenterLicenseDto (agency viewer,
 *       states accepted..returned else 409 IDENTITY_NOT_AVAILABLE; every read is logged)
 */

/** `GET /agency/fleet` query — `pageSize` lets pickers walk the whole fleet. */
export interface FleetFilters {
  status?: CarStatus;
  page?: number;
  pageSize?: number;
}

/** `GET /agency/requests` query. */
export interface RequestFilters {
  state?: string;
  page?: number;
  pageSize?: number;
}

export const agencyKeys = {
  all: ["agency"] as const,
  /** Prefix of every fleet read (paged + infinite) — invalidate after a car changes. */
  fleetAll: () => ["agency", "fleet"] as const,
  fleet: (filters: FleetFilters = {}) => ["agency", "fleet", filters] as const,
  /** Infinite-query variant (page lives in the page params, not the key). */
  fleetPages: (filters: Omit<FleetFilters, "page"> = {}) =>
    ["agency", "fleet", "pages", filters] as const,
  calendar: (carId: string | null, month: string) =>
    ["agency", "calendar", carId, month] as const,
  requests: (filters: RequestFilters = {}) =>
    ["agency", "requests", filters] as const,
  /** Inspections of one booking (signed media URLs — short TTL). */
  inspections: (bookingId: string) =>
    ["agency", "requests", bookingId, "inspections"] as const,
  /** Damage claims of one booking (current + history). */
  claims: (bookingId: string) =>
    ["agency", "requests", bookingId, "claims"] as const,
  carPhotos: (carId: string) => ["agency", "car-photos", carId] as const,
  carDocuments: (carId: string) => ["agency", "car-documents", carId] as const,
  branches: () => ["agency", "branches"] as const,
  zones: (branchId: string) => ["agency", "zones", branchId] as const,
  wallet: () => ["agency", "wallet"] as const,
  payouts: () => ["agency", "wallet", "payouts"] as const,
  payoutAccount: () => ["agency", "payout-account"] as const,
  settings: () => ["agency", "settings"] as const,
  hostAgreement: () => ["agency", "host-agreement"] as const,
  session: () => ["agency", "session"] as const,
  staff: () => ["agency", "staff"] as const,
};

/**
 * `PATCH /agency/settings` body (backend `UpdateAgencySettingsDto`). Every
 * field is optional — send only what changed. `payoutBankDetails: null`
 * clears the bank account, `logoUrl: null` removes the logo; an empty
 * `rentalConditions` string clears the conditions server-side.
 */
export interface UpdateAgencySettingsInput {
  name?: string;
  description?: string;
  logoUrl?: string | null;
  rentalConditions?: string;
  minDriverAge?: number;
  depositNote?: string;
  payoutBankDetails?: PayoutBankDetails | null;
}

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
  /**
   * Security deposit override, integer cents (spec §3 `Car.depositCents`).
   * Omitted / `null` = the platform default deposit applies.
   */
  depositCents?: number | null;
  photos?: string[];
}

/**
 * `PATCH /agency/fleet/:carId` body (backend `UpdateCarDto` = partial
 * `CreateCarDto` minus `branchId`, plus `status`). Activation (`status:
 * "active"`) is gated server-side: agency verified ∧ host agreement signed ∧
 * (business ∨ verified registration document).
 */
export type UpdateCarInput = Partial<Omit<CreateCarInput, "branchId">> & {
  status?: CarStatus;
};

/** `POST /agency/host-agreement/sign` body (backend `SignContractDto`). */
export interface SignContractInput {
  typedName: string;
  acceptTerms: true;
  /** The version the signer read — 409 HOST_AGREEMENT_OUTDATED when stale. */
  templateVersion: number;
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
  /** Omitted = unchanged/none; `null` (edit only) clears the stored number. */
  phone?: string | null;
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

// ── Inspections & claims (ADR-0011 / ADR-0013) ─────────────────────────────

/** `POST /agency/requests/:bookingId/inspections` body. */
export interface CreateInspectionInput {
  type: InspectionType;
}

/** `PATCH /agency/inspections/:id` body — every field optional, draft only. */
export interface UpdateInspectionInput {
  odometerKm?: number;
  /** 0 (empty) … 8 (full). */
  fuelLevelEighths?: number;
  /** ≤ 4000 characters. */
  damageNotes?: string;
  damageFlagged?: boolean;
}

/**
 * `POST /agency/inspections/:id/media` body. The server pins `contentType`
 * and `sizeBytes` into the signed PUT, so the browser must send exactly
 * that file (its Content-Length is set automatically from the blob).
 */
export interface RegisterInspectionMediaInput {
  kind: MediaKind;
  label: MediaLabel;
  contentType: string;
  sizeBytes: number;
  /** Required for videos (≤ the platform's max seconds). */
  durationSeconds?: number;
}

/** `POST /agency/requests/:bookingId/claims` body. */
export interface FileClaimInput {
  /** Integer cents, > 0 (server cap: 400 CLAIM_AMOUNT_EXCEEDS_LIMIT). */
  requestedCents: number;
  /** 10..4000 characters. */
  description: string;
  /** Inspection media ids of THIS booking, ≤ 20. */
  evidenceMediaIds: string[];
}

export const AgencyApi = {
  // ------------------------------------------------------------- fleet

  async fleet(filters: FleetFilters = {}): Promise<Paginated<AgencyCar>> {
    const res = await Api.get("/agency/fleet", { params: filters });
    return res.data;
  },

  async createCar(input: CreateCarInput): Promise<AgencyCar> {
    const res = await Api.post("/agency/fleet", input);
    return res.data;
  },

  async updateCar(carId: string, input: UpdateCarInput): Promise<AgencyCar> {
    const res = await Api.patch(`/agency/fleet/${carId}`, input);
    return res.data;
  },

  // ------------------------------------------------------ car documents
  // Per-car registration document (ADR-0009). Replace-by-type: uploading a
  // new file for the same `type` supersedes the previous one and resets the
  // status to `pending` for admin review.

  async carDocuments(carId: string): Promise<CarDocumentDto[]> {
    const res = await Api.get(`/agency/fleet/${carId}/documents`);
    return res.data;
  },

  async uploadCarDocument(
    carId: string,
    file: File,
    type: string,
  ): Promise<CarDocumentDto> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post(`/agency/fleet/${carId}/documents`, form);
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
    filters: RequestFilters = {},
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

  // ── Agency-side cancellation (reason required, customer refunded 100%) ──

  /** accepted → cancelled, before the rental starts. */
  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.patch(`/agency/requests/${bookingId}/cancel`, {
      reason,
    });
    return res.data;
  },

  /** active → cancelled mid-rental (the car came back early / incident). */
  async cancelActiveBooking(
    bookingId: string,
    reason: string,
  ): Promise<Booking> {
    const res = await Api.post(`/bookings/${bookingId}/cancel-active`, {
      reason,
    });
    return res.data;
  },

  /**
   * The AGENCY view of one booking (viewer `agency`: carries `customer` and
   * `agreement`, never `payment`). Same route the customer uses; the backend
   * picks the viewer from who is asking.
   */
  async bookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await Api.get(`/bookings/${bookingId}`);
    return res.data;
  },

  // ── Inspections (ADR-0011) ──
  // Direct-to-storage media: register → PUT the bytes to the signed URL →
  // complete. The API never buffers the files (see inspection-media-upload.ts).

  async inspections(bookingId: string): Promise<InspectionDto[]> {
    const res = await Api.get<InspectionDto[]>(
      `/agency/requests/${bookingId}/inspections`,
    );
    return res.data;
  },

  /** Open a check-in / check-out draft (check-in also starts the deposit hold). */
  async createInspection(
    bookingId: string,
    input: CreateInspectionInput,
  ): Promise<InspectionDto> {
    const res = await Api.post<InspectionDto>(
      `/agency/requests/${bookingId}/inspections`,
      input,
    );
    return res.data;
  },

  async updateInspection(
    inspectionId: string,
    input: UpdateInspectionInput,
  ): Promise<InspectionDto> {
    const res = await Api.patch<InspectionDto>(
      `/agency/inspections/${inspectionId}`,
      input,
    );
    return res.data;
  },

  /** Reserve a media slot: a `pending_upload` row + a single-use signed PUT. */
  async registerInspectionMedia(
    inspectionId: string,
    input: RegisterInspectionMediaInput,
  ): Promise<InspectionMediaUploadDto> {
    const res = await Api.post<InspectionMediaUploadDto>(
      `/agency/inspections/${inspectionId}/media`,
      input,
    );
    return res.data;
  },

  /** After the PUT: the server verifies the object and marks it `uploaded`. */
  async completeInspectionMedia(
    inspectionId: string,
    mediaId: string,
  ): Promise<InspectionMediaDto> {
    const res = await Api.post<InspectionMediaDto>(
      `/agency/inspections/${inspectionId}/media/${mediaId}/complete`,
    );
    return res.data;
  },

  async deleteInspectionMedia(
    inspectionId: string,
    mediaId: string,
  ): Promise<void> {
    await Api.delete(`/agency/inspections/${inspectionId}/media/${mediaId}`);
  },

  /** Hand the record to the customer for confirmation (`submitted`). */
  async submitInspection(inspectionId: string): Promise<InspectionDto> {
    const res = await Api.post<InspectionDto>(
      `/agency/inspections/${inspectionId}/submit`,
    );
    return res.data;
  },

  /** The customer is not there to confirm: finalize as `confirmed_absent`. */
  async markCustomerAbsent(
    inspectionId: string,
    reason: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<InspectionDto>(
      `/agency/inspections/${inspectionId}/customer-absent`,
      { reason },
    );
    return res.data;
  },

  // ── Damage claims (ADR-0013) ──

  async claims(bookingId: string): Promise<ClaimDto[]> {
    const res = await Api.get<ClaimDto[]>(
      `/agency/requests/${bookingId}/claims`,
    );
    return res.data;
  },

  /** File a claim against the deposit within the dispute window. */
  async fileClaim(bookingId: string, input: FileClaimInput): Promise<ClaimDto> {
    const res = await Api.post<ClaimDto>(
      `/agency/requests/${bookingId}/claims`,
      input,
    );
    return res.data;
  },

  /** Withdraw an `open | under_review` claim (releases the deposit hold). */
  async withdrawClaim(claimId: string): Promise<ClaimDto> {
    const res = await Api.post<ClaimDto>(`/agency/claims/${claimId}/withdraw`);
    return res.data;
  },

  // ── Renter identity (ADR-0011) ──

  /**
   * Short-lived signed URLs of the renter's licence (front/back) plus the
   * licence facts. Only from acceptance until the booking settles; the
   * server logs every read for the "who saw my licence" audit.
   */
  async renterLicense(bookingId: string): Promise<RenterLicenseDto> {
    const res = await Api.get<RenterLicenseDto>(
      `/bookings/${bookingId}/renter-license`,
    );
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

  async wallet(): Promise<AgencyWallet> {
    const res = await Api.get("/agency/wallet");
    return res.data;
  },

  async payouts(): Promise<Payout[]> {
    const res = await Api.get("/agency/wallet/payouts");
    return res.data;
  },

  /** Ask for a bank transfer of `amountCents` (≤ `availableCents`, ≥ 1000). */
  async requestPayout(amountCents: number): Promise<Payout> {
    const res = await Api.post("/agency/wallet/payouts", { amountCents });
    return res.data;
  },

  // ----------------------------------------------- Stripe payout account
  // ADR-0012: Stripe Global Payouts recipient. Onboarding is Stripe-hosted —
  // the link is single-use and expires in ~10 minutes, so it is fetched on
  // click and opened in the SAME tab; Stripe sends the host back to
  // `/agency/wallet?stripe=return|refresh`, where the page calls `sync`.

  async payoutAccount(): Promise<PayoutAccountDto> {
    const res = await Api.get("/agency/payout-account");
    return res.data;
  },

  async payoutAccountOnboardingLink(): Promise<SignedUrlDto> {
    const res = await Api.post("/agency/payout-account/onboarding-link", {});
    return res.data;
  },

  /** Re-read the recipient from Stripe (status, requirements, bank last4). */
  async syncPayoutAccount(): Promise<PayoutAccountDto> {
    const res = await Api.post("/agency/payout-account/sync", {});
    return res.data;
  },

  // ---------------------------------------------------------- settings

  async settings(): Promise<AgencySettings> {
    const res = await Api.get("/agency/settings");
    return res.data;
  },

  async updateSettings(
    input: UpdateAgencySettingsInput,
  ): Promise<AgencySettings> {
    const res = await Api.patch("/agency/settings", input);
    return res.data;
  },

  // ---------------------------------------------- host agreement (ADR-0010)

  /** Current published version (rendered for this host) + the signed document, if any. */
  async hostAgreement(): Promise<HostAgreementStatusDto> {
    const res = await Api.get("/agency/host-agreement");
    return res.data;
  },

  /** Click-to-sign: typed name + checkbox; the server records IP/UA/time. */
  async signHostAgreement(
    input: SignContractInput,
  ): Promise<ContractDocumentDto> {
    const res = await Api.post("/agency/host-agreement/sign", input);
    return res.data;
  },

  /** Short-lived signed URL of the host's signed PDF. */
  async hostAgreementPdf(): Promise<SignedUrlDto> {
    const res = await Api.get("/agency/host-agreement/pdf");
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
