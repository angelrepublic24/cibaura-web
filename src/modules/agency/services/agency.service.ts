import { Api } from "@/shared/api/client";
import type {
  AgencyCancellationCover,
  AgencyCar,
  AgencyEarnings,
  AgencySettings,
  AgencyWallet,
  Booking,
  BookingDetail,
  Branch,
  CarDocumentDto,
  ClaimDto,
  ContractDocumentDto,
  DeliveryZoneFull,
  HostAgreementStatusDto,
  InspectionDto,
  InspectionMediaDto,
  InspectionMediaUploadDto,
  OccupancyEntry,
  Paginated,
  Payout,
  PayoutAccountDto,
  RenterLicenseDto,
  SignedUrlDto,
} from "@/shared/types/domain";
import {
  agencyCancellationCoverWireSchema,
  agencyCarPageWireSchema,
  agencyCarWireSchema,
  agencyEarningsWireSchema,
  agencyRequestPageWireSchema,
  agencySessionWireSchema,
  agencySettingsWireSchema,
  agencyWalletWireSchema,
  branchListWireSchema,
  branchWireSchema,
  carDocumentListWireSchema,
  carDocumentWireSchema,
  carPhotoListWireSchema,
  createBranchInputSchema,
  createCarInputSchema,
  createInspectionInputSchema,
  createStaffInputSchema,
  createZoneInputSchema,
  deliveryZoneFullListWireSchema,
  deliveryZoneFullWireSchema,
  fileClaimInputSchema,
  fleetFiltersSchema,
  hostAgreementStatusWireSchema,
  inspectionMediaUploadWireSchema,
  manualBlockInputSchema,
  occupancyEntryWireSchema,
  occupancyListWireSchema,
  payoutAccountWireSchema,
  payoutListWireSchema,
  payoutWireSchema,
  registerInspectionMediaInputSchema,
  renterLicenseWireSchema,
  requestFiltersSchema,
  signContractInputSchema,
  staffListWireSchema,
  staffMemberWireSchema,
  updateAgencySettingsInputSchema,
  updateBranchInputSchema,
  updateCarInputSchema,
  updateInspectionInputSchema,
  updateStaffInputSchema,
  walkInBookingInputSchema,
} from "@/modules/agency/schema/agency.schema";
import type {
  AgencyRequest,
  AgencySession,
  CarPhoto,
  CreateBranchInput,
  CreateCarInput,
  CreateInspectionInput,
  CreateStaffInput,
  CreateZoneInput,
  FileClaimInput,
  FleetFilters,
  ManualBlockInput,
  RegisterInspectionMediaInput,
  RequestFilters,
  SignContractInput,
  StaffMember,
  UpdateAgencySettingsInput,
  UpdateBranchInput,
  UpdateCarInput,
  PhotoUploadProgress,
  UpdateInspectionInput,
  UpdateStaffInput,
  UploadInspectionMediaInput,
  UploadStage,
  WalkInBookingInput,
} from "@/modules/agency/types/agency.types";
import {
  bookingDetailWireSchema,
  bookingWireSchema,
  claimWireSchema,
  inspectionListWireSchema,
  inspectionMediaWireSchema,
  inspectionWireSchema,
  signedUrlWireSchema,
} from "@/modules/bookings/schema/bookings.schema";
import { contractDocumentWireSchema } from "@/modules/legal/schema/legal.schema";
const claimListWireSchema = claimWireSchema.array();

/**
 * Agency dashboard API client (agency_owner / agency_staff) — the ONLY thing
 * in the module that talks to the backend. Hooks call these, components call
 * hooks.
 *
 * Every route is scoped to the CALLER's agency via RBAC — no agencyId in the
 * path; the agency itself is read through `GET /agency/session`:
 *  - GET    /agency/fleet?status&page               -> Paginated<AgencyCar> (private plate included)
 *  - POST   /agency/fleet  CreateCarInput           -> AgencyCar (status=draft)
 *  - PATCH  /agency/fleet/:carId UpdateCarInput     -> AgencyCar (`fleet:write`;
 *       status=active gated: 403 HOST_AGREEMENT_REQUIRED / CAR_REGISTRATION_REQUIRED)
 *  - GET    /agency/fleet/:carId/documents          -> CarDocumentDto[] (`fleet:read`)
 *  - POST   /agency/fleet/:carId/documents (multipart file + type) -> CarDocumentDto
 *       (`fleet:write`; replace-by-type, status resets to `pending`)
 *  - GET/POST/DELETE/PATCH /agency/fleet/:carId/photos[...]  -> CarPhoto[]
 *  - GET    /agency/calendar?carId&month=YYYY-MM    -> OccupancyEntry[]
 *  - POST   /agency/manual-blocks ManualBlockInput  -> OccupancyEntry
 *       (offline rentals land in CarOccupancy, so the DB exclusion
 *        constraint rejects overlaps: expect 409 on conflict)
 *  - DELETE /agency/manual-blocks/:id               -> 204
 *  - GET    /agency/requests?state&page             -> Paginated<AgencyRequest>
 *  - PATCH  /agency/requests/:bookingId/accept      -> Booking
 *       (state change + occupancy insert + payment capture in ONE
 *        transaction; may fail with reason "no_longer_available")
 *  - PATCH  /agency/requests/:bookingId/reject { reason 2..160 } -> Booking
 *  - PATCH  /agency/requests/:bookingId/handover-code { code } -> Booking
 *       (`bookings:handle`; 409 HANDOVER_CODE_MISMATCH / _LOCKED / _NOT_APPLICABLE)
 *  - PATCH  /agency/requests/:bookingId/pickup|return|settle -> Booking
 *  - PATCH  /agency/requests/:bookingId/cancel { reason } -> Booking
 *  - POST   /bookings/:bookingId/cancel-active { reason } -> Booking
 *  - GET    /agency/requests/:bookingId/cancellation-cover -> AgencyCancellationCover
 *  - GET/POST /agency/requests/:bookingId/inspections -> InspectionDto[] (signed media URLs)
 *  - PATCH  /agency/inspections/:id                 -> InspectionDto (draft only)
 *  - POST   /agency/inspections/:id/media           -> InspectionMediaUploadDto
 *  - POST   /agency/inspections/:id/media/:mediaId/complete -> InspectionMediaDto
 *  - DELETE /agency/inspections/:id/media/:mediaId  -> 204 (draft only)
 *  - POST   /agency/inspections/:id/submit          -> InspectionDto
 *  - POST   /agency/inspections/:id/customer-absent { reason 2..300 } -> InspectionDto
 *  - GET/POST /agency/requests/:bookingId/claims    -> ClaimDto[] / ClaimDto
 *  - POST   /agency/claims/:id/withdraw             -> ClaimDto (409 CLAIM_NOT_OPEN)
 *  - GET    /bookings/:bookingId/renter-license     -> RenterLicenseDto
 *       (states accepted..returned, else 409 IDENTITY_NOT_AVAILABLE; every read logged)
 *  - POST   /agency/walk-in-bookings                -> Booking (counter sale)
 *  - GET/POST/PATCH /agency/branches[...]           -> Branch / Branch[]
 *  - GET/POST /agency/branches/:branchId/zones      -> DeliveryZoneFull[]
 *  - DELETE /agency/zones/:zoneId                   -> 204
 *  - GET    /agency/wallet | /wallet/earnings | /wallet/payouts
 *  - POST   /agency/wallet/payouts { amountCents }  -> Payout (`wallet:withdraw`;
 *       409 INSUFFICIENT_BALANCE / PAYOUT_BANK_DETAILS_MISSING)
 *  - GET    /agency/payout-account                  -> PayoutAccountDto
 *  - POST   /agency/payout-account/onboarding-link  -> SignedUrlDto (owner only)
 *  - POST   /agency/payout-account/sync             -> PayoutAccountDto
 *  - GET/PATCH /agency/settings                     -> AgencySettings
 *  - POST   /agency/branding/:kind (multipart file)  -> AgencySettings
 *  - GET    /agency/host-agreement                  -> HostAgreementStatusDto
 *  - POST   /agency/host-agreement/sign             -> ContractDocumentDto
 *  - GET    /agency/host-agreement/pdf              -> SignedUrlDto
 *  - GET    /agency/session                         -> AgencySession
 *  - GET/POST/PATCH/DELETE /agency/staff[...]       -> StaffMember[]
 */
class AgencyService {
  // ── Fleet ─────────────────────────────────────────────────────────────────

  async fleet(filters: FleetFilters = {}): Promise<Paginated<AgencyCar>> {
    const res = await Api.get<unknown>("/agency/fleet", {
      params: fleetFiltersSchema.parse(filters),
    });
    return agencyCarPageWireSchema.parse(res.data);
  }

  async createCar(input: CreateCarInput): Promise<AgencyCar> {
    const res = await Api.post<unknown>(
      "/agency/fleet",
      createCarInputSchema.parse(input),
    );
    return agencyCarWireSchema.parse(res.data);
  }

  async updateCar(carId: string, input: UpdateCarInput): Promise<AgencyCar> {
    const res = await Api.patch<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}`,
      updateCarInputSchema.parse(input),
    );
    return agencyCarWireSchema.parse(res.data);
  }

  // ── Car documents ─────────────────────────────────────────────────────────
  // Per-car registration document (ADR-0009). Replace-by-type: a new file for
  // the same `type` supersedes the previous one and resets the status to
  // `pending` for admin review.

  async carDocuments(carId: string): Promise<CarDocumentDto[]> {
    const res = await Api.get<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}/documents`,
    );
    return carDocumentListWireSchema.parse(res.data);
  }

  async uploadCarDocument(
    carId: string,
    file: File,
    type: string,
  ): Promise<CarDocumentDto> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}/documents`,
      form,
    );
    return carDocumentWireSchema.parse(res.data);
  }

  // ── Car photos ────────────────────────────────────────────────────────────
  // Backend: /agency/fleet/:carId/photos (owning agency + FLEET_WRITE); the
  // public read is GET /cars/photos/:photoId (streamed, cached).

  async carPhotos(carId: string): Promise<CarPhoto[]> {
    const res = await Api.get<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}/photos`,
    );
    return carPhotoListWireSchema.parse(res.data);
  }

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
    const res = await Api.post<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}/photos`,
      form,
      {
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      },
    );
    return carPhotoListWireSchema.parse(res.data);
  }

  async deleteCarPhoto(carId: string, photoId: string): Promise<void> {
    await Api.delete(
      `/agency/fleet/${encodeURIComponent(carId)}/photos/${encodeURIComponent(photoId)}`,
    );
  }

  /** Full-set reorder — send every photo id; index 0 becomes the cover. */
  async reorderCarPhotos(
    carId: string,
    photoIds: string[],
  ): Promise<CarPhoto[]> {
    const res = await Api.patch<unknown>(
      `/agency/fleet/${encodeURIComponent(carId)}/photos/order`,
      { photoIds },
    );
    return carPhotoListWireSchema.parse(res.data);
  }

  /**
   * Upload gallery files ONE BY ONE (per-file progress + per-file errors;
   * order is preserved because the backend appends in request order). Never
   * throws — each failure is reported through `onProgress`. Returns how many
   * files uploaded successfully.
   */
  async uploadCarPhotosSequentially(
    carId: string,
    files: File[],
    onProgress: (update: PhotoUploadProgress) => void,
  ): Promise<number> {
    let uploaded = 0;
    for (const [index, file] of files.entries()) {
      onProgress({ index, status: "uploading", percent: 0 });
      try {
        await this.uploadCarPhoto(carId, file, (percent) =>
          onProgress({ index, status: "uploading", percent }),
        );
        uploaded += 1;
        onProgress({ index, status: "done", percent: 100 });
      } catch (err) {
        onProgress({
          index,
          status: "error",
          percent: 0,
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
    return uploaded;
  }

  // ── Calendar ──────────────────────────────────────────────────────────────

  async calendar(
    carId: string | null,
    month: string,
  ): Promise<OccupancyEntry[]> {
    const res = await Api.get<unknown>("/agency/calendar", {
      params: { carId: carId ?? undefined, month },
    });
    return occupancyListWireSchema.parse(res.data);
  }

  async createManualBlock(input: ManualBlockInput): Promise<OccupancyEntry> {
    const res = await Api.post<unknown>(
      "/agency/manual-blocks",
      manualBlockInputSchema.parse(input),
    );
    return occupancyEntryWireSchema.parse(res.data);
  }

  async deleteManualBlock(blockId: string): Promise<void> {
    await Api.delete(`/agency/manual-blocks/${encodeURIComponent(blockId)}`);
  }

  // ── Requests (the inbox) ──────────────────────────────────────────────────

  async requests(
    filters: RequestFilters = {},
  ): Promise<Paginated<AgencyRequest>> {
    const res = await Api.get<unknown>("/agency/requests", {
      params: requestFiltersSchema.parse(filters),
    });
    return agencyRequestPageWireSchema.parse(res.data);
  }

  async acceptRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/accept`,
      {},
    );
    return bookingWireSchema.parse(res.data);
  }

  async rejectRequest(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/reject`,
      { reason },
    );
    return bookingWireSchema.parse(res.data);
  }

  // ── Lifecycle after accept (pickup → return → settle) ─────────────────────

  /**
   * The renter reads out their six digits and the host types them here.
   * A separate step from the pick-up because two different actions move a
   * booking into `active`, and both read the stamp this writes.
   */
  async confirmHandover(bookingId: string, code: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/handover-code`,
      { code },
    );
    return bookingWireSchema.parse(res.data);
  }

  /**
   * What cancelling this booking would cost the agency right now.
   *
   * A read with no side effects, so the host sees the figure BEFORE they
   * decide rather than on a wallet statement afterwards.
   */
  async cancellationCover(
    bookingId: string,
  ): Promise<AgencyCancellationCover> {
    const res = await Api.get<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/cancellation-cover`,
    );
    return agencyCancellationCoverWireSchema.parse(res.data);
  }

  /** Customer collected the car: accepted → active (stamps pickedUpAt). */
  async pickupRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/pickup`,
      {},
    );
    return bookingWireSchema.parse(res.data);
  }

  /** Car is back at the branch: active → returned. */
  async returnRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/return`,
      {},
    );
    return bookingWireSchema.parse(res.data);
  }

  /** Close the money-path: returned → settled (payout hits the wallet). */
  async settleRequest(bookingId: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/settle`,
      {},
    );
    return bookingWireSchema.parse(res.data);
  }

  // ── Agency-side cancellation (reason required, customer refunded 100%) ────

  /** accepted → cancelled, before the rental starts. */
  async cancelBooking(bookingId: string, reason: string): Promise<Booking> {
    const res = await Api.patch<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/cancel`,
      { reason },
    );
    return bookingWireSchema.parse(res.data);
  }

  /** active → cancelled mid-rental (the car came back early / incident). */
  async cancelActiveBooking(
    bookingId: string,
    reason: string,
  ): Promise<Booking> {
    const res = await Api.post<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/cancel-active`,
      { reason },
    );
    return bookingWireSchema.parse(res.data);
  }

  /**
   * The AGENCY view of one booking (viewer `agency`: carries `customer` and
   * `agreement`, never `payment`). Same route the customer uses; the backend
   * picks the viewer from who is asking.
   */
  async bookingDetail(bookingId: string): Promise<BookingDetail> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}`,
    );
    return bookingDetailWireSchema.parse(res.data);
  }

  // ── Inspections (ADR-0011) ────────────────────────────────────────────────
  // Direct-to-storage media: register → PUT the bytes to the signed URL →
  // complete. The API never buffers the files.

  async inspections(bookingId: string): Promise<InspectionDto[]> {
    const res = await Api.get<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/inspections`,
    );
    return inspectionListWireSchema.parse(res.data);
  }

  /** Open a check-in / check-out draft (check-in also starts the deposit hold). */
  async createInspection(
    bookingId: string,
    input: CreateInspectionInput,
  ): Promise<InspectionDto> {
    const res = await Api.post<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/inspections`,
      createInspectionInputSchema.parse(input),
    );
    return inspectionWireSchema.parse(res.data);
  }

  async updateInspection(
    inspectionId: string,
    input: UpdateInspectionInput,
  ): Promise<InspectionDto> {
    const res = await Api.patch<unknown>(
      `/agency/inspections/${encodeURIComponent(inspectionId)}`,
      updateInspectionInputSchema.parse(input),
    );
    return inspectionWireSchema.parse(res.data);
  }

  /** Reserve a media slot: a `pending_upload` row + a single-use signed PUT. */
  async registerInspectionMedia(
    inspectionId: string,
    input: RegisterInspectionMediaInput,
  ): Promise<InspectionMediaUploadDto> {
    const res = await Api.post<unknown>(
      `/agency/inspections/${encodeURIComponent(inspectionId)}/media`,
      registerInspectionMediaInputSchema.parse(input),
    );
    return inspectionMediaUploadWireSchema.parse(res.data);
  }

  /** After the PUT: the server verifies the object and marks it `uploaded`. */
  async completeInspectionMedia(
    inspectionId: string,
    mediaId: string,
  ): Promise<InspectionMediaDto> {
    const res = await Api.post<unknown>(
      `/agency/inspections/${encodeURIComponent(inspectionId)}/media/${encodeURIComponent(mediaId)}/complete`,
    );
    return inspectionMediaWireSchema.parse(res.data);
  }

  async deleteInspectionMedia(
    inspectionId: string,
    mediaId: string,
  ): Promise<void> {
    await Api.delete(
      `/agency/inspections/${encodeURIComponent(inspectionId)}/media/${encodeURIComponent(mediaId)}`,
    );
  }

  /**
   * The whole direct-to-storage pipeline for ONE file: register → PUT →
   * complete. Resolves with the server's media row (status `uploaded`,
   * signed URL). Throws {@link InspectionUploadError}; callers retry by
   * deleting `mediaId` (when set) and calling this again — the server mints
   * a fresh signed URL, because the old one is single-use and expires.
   */
  async uploadInspectionMedia(
    input: UploadInspectionMediaInput,
  ): Promise<InspectionMediaDto> {
    const { inspectionId, kind, label, file, durationSeconds, signal } = input;
    const onProgress = input.onProgress ?? (() => undefined);
    const onStage = input.onStage ?? (() => undefined);

    let registered: InspectionMediaUploadDto;
    onStage("registering");
    try {
      registered = await this.registerInspectionMedia(inspectionId, {
        kind,
        label,
        contentType: file.type,
        sizeBytes: file.size,
        ...(kind === "video" ? { durationSeconds } : {}),
      });
    } catch (reason) {
      throw new InspectionUploadError("registering", null, reason);
    }

    const mediaId = registered.media.id;
    onStage("uploading");
    try {
      await putToSignedUrl(registered.upload, file, onProgress, signal);
    } catch (reason) {
      throw new InspectionUploadError("uploading", mediaId, reason);
    }

    onStage("completing");
    try {
      return await this.completeInspectionMedia(inspectionId, mediaId);
    } catch (reason) {
      throw new InspectionUploadError("completing", mediaId, reason);
    }
  }

  /** Hand the record to the customer for confirmation (`submitted`). */
  async submitInspection(inspectionId: string): Promise<InspectionDto> {
    const res = await Api.post<unknown>(
      `/agency/inspections/${encodeURIComponent(inspectionId)}/submit`,
    );
    return inspectionWireSchema.parse(res.data);
  }

  /** The customer is not there to confirm: finalize as `confirmed_absent`. */
  async markCustomerAbsent(
    inspectionId: string,
    reason: string,
  ): Promise<InspectionDto> {
    const res = await Api.post<unknown>(
      `/agency/inspections/${encodeURIComponent(inspectionId)}/customer-absent`,
      { reason },
    );
    return inspectionWireSchema.parse(res.data);
  }

  // ── Damage claims (ADR-0013) ──────────────────────────────────────────────

  async claims(bookingId: string): Promise<ClaimDto[]> {
    const res = await Api.get<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/claims`,
    );
    return claimListWireSchema.parse(res.data);
  }

  /** File a claim against the deposit within the dispute window. */
  async fileClaim(
    bookingId: string,
    input: FileClaimInput,
  ): Promise<ClaimDto> {
    const res = await Api.post<unknown>(
      `/agency/requests/${encodeURIComponent(bookingId)}/claims`,
      fileClaimInputSchema.parse(input),
    );
    return claimWireSchema.parse(res.data);
  }

  /** Withdraw an `open | under_review` claim (releases the deposit hold). */
  async withdrawClaim(claimId: string): Promise<ClaimDto> {
    const res = await Api.post<unknown>(
      `/agency/claims/${encodeURIComponent(claimId)}/withdraw`,
    );
    return claimWireSchema.parse(res.data);
  }

  // ── Renter identity (ADR-0011) ────────────────────────────────────────────

  /**
   * Short-lived signed URLs of the renter's licence (front/back) plus the
   * licence facts. Only from acceptance until the booking settles; the
   * server logs every read for the "who saw my licence" audit.
   */
  async renterLicense(bookingId: string): Promise<RenterLicenseDto> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/renter-license`,
    );
    return renterLicenseWireSchema.parse(res.data);
  }

  // ── Walk-in (counter) sale ────────────────────────────────────────────────

  async walkInBooking(input: WalkInBookingInput): Promise<Booking> {
    const res = await Api.post<unknown>(
      "/agency/walk-in-bookings",
      walkInBookingInputSchema.parse(input),
    );
    return bookingWireSchema.parse(res.data);
  }

  // ── Branches & zones ──────────────────────────────────────────────────────

  async branches(): Promise<Branch[]> {
    const res = await Api.get<unknown>("/agency/branches");
    return branchListWireSchema.parse(res.data);
  }

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    const res = await Api.post<unknown>(
      "/agency/branches",
      createBranchInputSchema.parse(input),
    );
    return branchWireSchema.parse(res.data);
  }

  async updateBranch(
    branchId: string,
    input: UpdateBranchInput,
  ): Promise<Branch> {
    const res = await Api.patch<unknown>(
      `/agency/branches/${encodeURIComponent(branchId)}`,
      updateBranchInputSchema.parse(input),
    );
    return branchWireSchema.parse(res.data);
  }

  async zones(branchId: string): Promise<DeliveryZoneFull[]> {
    const res = await Api.get<unknown>(
      `/agency/branches/${encodeURIComponent(branchId)}/zones`,
    );
    return deliveryZoneFullListWireSchema.parse(res.data);
  }

  async createZone(
    branchId: string,
    input: CreateZoneInput,
  ): Promise<DeliveryZoneFull> {
    const res = await Api.post<unknown>(
      `/agency/branches/${encodeURIComponent(branchId)}/zones`,
      createZoneInputSchema.parse(input),
    );
    return deliveryZoneFullWireSchema.parse(res.data);
  }

  async deleteZone(zoneId: string): Promise<void> {
    await Api.delete(`/agency/zones/${encodeURIComponent(zoneId)}`);
  }

  // ── Wallet ────────────────────────────────────────────────────────────────

  async wallet(): Promise<AgencyWallet> {
    const res = await Api.get<unknown>("/agency/wallet");
    return agencyWalletWireSchema.parse(res.data);
  }

  async earnings(): Promise<AgencyEarnings> {
    const res = await Api.get<unknown>("/agency/wallet/earnings");
    return agencyEarningsWireSchema.parse(res.data);
  }

  async payouts(): Promise<Payout[]> {
    const res = await Api.get<unknown>("/agency/wallet/payouts");
    return payoutListWireSchema.parse(res.data);
  }

  /** Ask for a bank transfer of `amountCents` (≤ `availableCents`, ≥ 1000). */
  async requestPayout(amountCents: number): Promise<Payout> {
    const res = await Api.post<unknown>("/agency/wallet/payouts", {
      amountCents,
    });
    return payoutWireSchema.parse(res.data);
  }

  // ── Stripe payout account (ADR-0012) ──────────────────────────────────────
  // Onboarding is Stripe-hosted — the link is single-use and expires in ~10
  // minutes, so it is fetched on click and opened in the SAME tab; Stripe
  // sends the host back to `/agency/wallet?stripe=return|refresh`, where the
  // page calls `sync`.

  async payoutAccount(): Promise<PayoutAccountDto> {
    const res = await Api.get<unknown>("/agency/payout-account");
    return payoutAccountWireSchema.parse(res.data);
  }

  async payoutAccountOnboardingLink(): Promise<SignedUrlDto> {
    const res = await Api.post<unknown>(
      "/agency/payout-account/onboarding-link",
      {},
    );
    return signedUrlWireSchema.parse(res.data);
  }

  /** Re-read the recipient from Stripe (status, requirements, bank last4). */
  async syncPayoutAccount(): Promise<PayoutAccountDto> {
    const res = await Api.post<unknown>("/agency/payout-account/sync", {});
    return payoutAccountWireSchema.parse(res.data);
  }

  // ── Settings & branding ───────────────────────────────────────────────────

  async settings(): Promise<AgencySettings> {
    const res = await Api.get<unknown>("/agency/settings");
    return agencySettingsWireSchema.parse(res.data);
  }

  async updateSettings(
    input: UpdateAgencySettingsInput,
  ): Promise<AgencySettings> {
    const res = await Api.patch<unknown>(
      "/agency/settings",
      updateAgencySettingsInputSchema.parse(input),
    );
    return agencySettingsWireSchema.parse(res.data);
  }

  /**
   * Upload the storefront logo or banner (multipart field `file`). The image
   * is stored server-side and the matching url is pointed at the public
   * branding stream; returns the updated settings so the form re-seeds with
   * the new image. Mirrors `uploadCarPhoto`.
   */
  async uploadBranding(
    kind: "logo" | "banner",
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<AgencySettings> {
    const form = new FormData();
    form.append("file", file);
    const res = await Api.post<unknown>(`/agency/branding/${kind}`, form, {
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      },
    });
    return agencySettingsWireSchema.parse(res.data);
  }

  // ── Host agreement (ADR-0010) ─────────────────────────────────────────────

  /** Current published version (rendered for this host) + the signed document, if any. */
  async hostAgreement(): Promise<HostAgreementStatusDto> {
    const res = await Api.get<unknown>("/agency/host-agreement");
    return hostAgreementStatusWireSchema.parse(res.data);
  }

  /** Click-to-sign: typed name + checkbox; the server records IP/UA/time. */
  async signHostAgreement(
    input: SignContractInput,
  ): Promise<ContractDocumentDto> {
    const res = await Api.post<unknown>(
      "/agency/host-agreement/sign",
      signContractInputSchema.parse(input),
    );
    return contractDocumentWireSchema.parse(res.data);
  }

  /** Short-lived signed URL of the host's signed PDF. */
  async hostAgreementPdf(): Promise<SignedUrlDto> {
    const res = await Api.get<unknown>("/agency/host-agreement/pdf");
    return signedUrlWireSchema.parse(res.data);
  }

  // ── Session & staff (RBAC) ────────────────────────────────────────────────

  async session(): Promise<AgencySession> {
    const res = await Api.get<unknown>("/agency/session");
    return agencySessionWireSchema.parse(res.data);
  }

  async staff(): Promise<StaffMember[]> {
    const res = await Api.get<unknown>("/agency/staff");
    return staffListWireSchema.parse(res.data);
  }

  async createStaff(input: CreateStaffInput): Promise<StaffMember> {
    const res = await Api.post<unknown>(
      "/agency/staff",
      createStaffInputSchema.parse(input),
    );
    return staffMemberWireSchema.parse(res.data);
  }

  async updateStaff(
    userId: string,
    input: UpdateStaffInput,
  ): Promise<StaffMember> {
    const res = await Api.patch<unknown>(
      `/agency/staff/${encodeURIComponent(userId)}`,
      updateStaffInputSchema.parse(input),
    );
    return staffMemberWireSchema.parse(res.data);
  }

  async removeStaff(userId: string): Promise<void> {
    await Api.delete(`/agency/staff/${encodeURIComponent(userId)}`);
  }
}

// ── Direct-to-storage upload transport ──────────────────────────────────────

/** Where an upload failed + the pending row to discard before retrying. */
export class InspectionUploadError extends Error {
  readonly stage: UploadStage;
  readonly mediaId: string | null;
  /** The underlying failure (an axios error for API stages, a plain Error for the PUT). */
  readonly reason: unknown;

  constructor(stage: UploadStage, mediaId: string | null, reason: unknown) {
    super(
      reason instanceof Error && reason.message
        ? reason.message
        : "Upload failed",
    );
    this.name = "InspectionUploadError";
    this.stage = stage;
    this.mediaId = mediaId;
    this.reason = reason;
  }
}

/** True for a cancellation (the user removed the row mid-upload) — not an error to show. */
export function isUploadAborted(error: unknown): boolean {
  const reason = error instanceof InspectionUploadError ? error.reason : error;
  return reason instanceof DOMException && reason.name === "AbortError";
}

/** Forbidden request headers the browser sets itself (spec: never via setRequestHeader). */
const BROWSER_MANAGED_HEADERS = new Set(["content-length", "host"]);

/**
 * PUT the file to the signed URL with progress events (XHR — `fetch` has no
 * upload progress). Sends the headers the signature was computed with and
 * the declared Content-Type; Content-Length comes from the blob, which is
 * why `sizeBytes` must equal `file.size` at registration.
 */
function putToSignedUrl(
  upload: InspectionMediaUploadDto["upload"],
  file: File,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(upload.method, upload.url);
    xhr.withCredentials = false;

    let contentTypeSet = false;
    for (const [name, value] of Object.entries(upload.headers)) {
      const lower = name.toLowerCase();
      if (BROWSER_MANAGED_HEADERS.has(lower)) continue;
      if (lower === "content-type") contentTypeSet = true;
      xhr.setRequestHeader(name, value);
    }
    if (!contentTypeSet) xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 403
              ? "The upload link expired before the file was sent."
              : `Storage rejected the upload (HTTP ${xhr.status}).`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error("Network error while uploading — check your connection."),
      );
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));

    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.onloadend = () => signal?.removeEventListener("abort", abort);

    xhr.send(file);
  });
}

export const agencyService = new AgencyService();
