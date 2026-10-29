import { useCallback, useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { agencyService } from "@/modules/agency/services/agency.service";
import { fleetForScope } from "@/modules/agency/helpers/agency.helper";
import type {
  AgencyPermission,
  BranchScope,
  CreateBranchInput,
  CreateCarInput,
  CreateInspectionInput,
  CreateStaffInput,
  CreateZoneInput,
  FileClaimInput,
  FleetFilters,
  ManualBlockInput,
  RequestFilters,
  SignContractInput,
  StaffRole,
  UpdateAgencySettingsInput,
  UpdateBranchInput,
  UpdateCarInput,
  PhotoUploadProgress,
  UpdateInspectionInput,
  UpdateStaffInput,
  WalkInBookingInput,
} from "@/modules/agency/types/agency.types";
import { bookingKeys } from "@/modules/bookings/hooks/bookings.hook";
import { useOpenSignedUrl } from "@/shared/hooks/use-open-signed-url";
import { API_ERROR_CODES, isApiErrorCode } from "@/shared/api/errors";
import type {
  AgencyCar,
  CarDocumentDto,
  HostAgreementStatusDto,
  InspectionDto,
  Paginated,
  PayoutAccountDto,
} from "@/shared/types/domain";

/** Query keys for the agency module (the only cache it owns). */
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
  /** What cancelling one booking would cost right now. */
  cancellationCover: (bookingId: string) =>
    ["agency", "requests", bookingId, "cancellation-cover"] as const,
  carPhotos: (carId: string) => ["agency", "car-photos", carId] as const,
  carDocuments: (carId: string) => ["agency", "car-documents", carId] as const,
  branches: () => ["agency", "branches"] as const,
  zones: (branchId: string) => ["agency", "zones", branchId] as const,
  wallet: () => ["agency", "wallet"] as const,
  earnings: () => ["agency", "wallet", "earnings"] as const,
  payouts: () => ["agency", "wallet", "payouts"] as const,
  payoutAccount: () => ["agency", "payout-account"] as const,
  settings: () => ["agency", "settings"] as const,
  hostAgreement: () => ["agency", "host-agreement"] as const,
  session: () => ["agency", "session"] as const,
  staff: () => ["agency", "staff"] as const,
};

/**
 * After anything that moves a booking on the agency side (an inspection
 * finalizes, a claim is filed, the booking settles): the inbox, calendar
 * and wallet shift, the booking's own sub-resources are stale, and the
 * detail (`GET /bookings/:id`, keyed under `bookings`) must refetch too.
 */
export function invalidateAgencyBooking(
  qc: QueryClient,
  bookingId: string,
): void {
  void qc.invalidateQueries({ queryKey: agencyKeys.all });
  void qc.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
}

/**
 * The same refresh as a callback, for callers that hand one to something
 * else (a child's `onDone`) instead of chaining it off a mutation.
 */
export function useInvalidateAgencyBooking(bookingId: string): () => void {
  const qc = useQueryClient();
  return useCallback(
    () => invalidateAgencyBooking(qc, bookingId),
    [qc, bookingId],
  );
}

// ── Session & permissions ───────────────────────────────────────────────────

/**
 * The caller's agency session (`GET /agency/session`): the agency (kind,
 * verification, host-agreement flags) + membership. Same key/staleTime as
 * `usePermission`, so the layout, nav and pages share ONE request.
 */
export function useAgencySession(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.session(),
    queryFn: () => agencyService.session(),
    staleTime: 60_000,
    enabled,
  });
}

export interface UsePermission {
  /** True while the session is being fetched for the first time — gate on this to avoid flicker. */
  isLoading: boolean;
  /**
   * No session data yet (first load, or the read failed before any data
   * landed). Permissions are UNKNOWN here — render a loading block, never
   * a "forbidden" one.
   */
  isPending: boolean;
  /** The session read failed: permissions are unknown, NOT denied. */
  isError: boolean;
  error: unknown;
  /** Re-run the session read (the "Try again" of an error block). */
  refetch: () => void;
  role: StaffRole | undefined;
  branchScope: BranchScope | undefined;
  /** Whether the current user holds a permission (owner → always true). */
  can: (permission: AgencyPermission) => boolean;
}

/**
 * Reads the caller's agency permission context from `GET /agency/session`
 * (owner → all permissions). Drives every agency-side permission gate. The
 * server is always the real authority — this only decides what to render.
 *
 * `can` is false until the session has loaded (fail closed), so callers
 * that would show a "no access" message must check `isPending`/`isError`
 * first: an unanswered or failed read is not a denial.
 */
export function usePermission(): UsePermission {
  const query = useAgencySession();

  const granted = new Set<AgencyPermission>(
    query.data?.membership.permissions ?? [],
  );

  return {
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
    role: query.data?.membership.role,
    branchScope: query.data?.membership.branchScope,
    can: (permission) => granted.has(permission),
  };
}

// ── Fleet ───────────────────────────────────────────────────────────────────

/** One page of the fleet — the dashboard reads `total` from it. */
export function useFleet(filters: FleetFilters = {}) {
  return useQuery({
    queryKey: agencyKeys.fleet(filters),
    queryFn: () => agencyService.fleet(filters),
  });
}

/** Page size for fleet pickers — large enough that one page covers most agencies. */
export const FLEET_PICKER_PAGE_SIZE = 100;

function nextFleetPage(last: Paginated<AgencyCar>): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined;
}

/**
 * The fleet as an infinite (page-by-page) list — the fleet screen renders
 * pages under a "Load more" button. `filters` never includes `page`; the
 * query owns paging.
 */
export function useFleetPages(filters: Omit<FleetFilters, "page"> = {}) {
  const session = useAgencySession();
  const scope = session.isError
    ? undefined
    : session.data?.membership.branchScope;
  return useInfiniteQuery({
    queryKey: [
      ...agencyKeys.fleetPages(filters),
      session.data?.agency.id,
      scope,
    ],
    enabled: Boolean(scope),
    queryFn: ({ pageParam }) =>
      agencyService.fleet({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: nextFleetPage,
    select: (data) => ({
      ...data,
      // Preserve server paging metadata: a filtered page can be empty while
      // later pages still contain authorized cars. Never display its raw total.
      pages: data.pages.map((page) => ({
        ...page,
        items: fleetForScope(page.items, scope),
      })),
    }),
  });
}

/**
 * EVERY car matching `filters`, for pickers (calendar filter, manual-block
 * car, walk-in car) where a `<select>` cannot paginate: walks the pages
 * (`pageSize = 100`) until the server reports no more. Exposes the flat list
 * plus the loading/error flags of the walk.
 */
export function useAllFleet(
  filters: Omit<FleetFilters, "page" | "pageSize"> = {},
) {
  const query = useFleetPages({ ...filters, pageSize: FLEET_PICKER_PAGE_SIZE });

  const { hasNextPage, isFetchingNextPage, isError, fetchNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  const cars: AgencyCar[] = query.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    cars,
    /** True until the LAST page has landed (pickers stay disabled meanwhile). */
    isLoading: query.isLoading || (hasNextPage === true && !query.isError),
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateCar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCarInput) => agencyService.createCar(input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() }),
  });
}

/**
 * Create a car and then upload its gallery, in that order — the photos
 * endpoint is per car, so there is nothing to upload to until the car
 * exists. Resolves with the car AND how many photos landed: a per-file
 * failure never loses the car, it just leaves the gallery incomplete, and
 * the caller decides where to send the host next.
 */
export function useCreateCarWithPhotos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      car: CreateCarInput;
      photos: File[];
      onPhotoProgress?: (update: PhotoUploadProgress) => void;
    }): Promise<{ car: AgencyCar; uploaded: number }> => {
      const created = await agencyService.createCar(input.car);
      if (input.photos.length === 0) return { car: created, uploaded: 0 };
      const uploaded = await agencyService.uploadCarPhotosSequentially(
        created.id,
        input.photos,
        input.onPhotoProgress ?? (() => undefined),
      );
      return { car: created, uploaded };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.all }),
  });
}

export function useUpdateCar(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCarInput) =>
      agencyService.updateCar(carId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() }),
  });
}

// ── Car documents (ADR-0009) ────────────────────────────────────────────────

export function useCarDocuments(carId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.carDocuments(carId),
    queryFn: () => agencyService.carDocuments(carId),
    enabled: enabled && !!carId,
  });
}

/**
 * Replace-by-type upload: a new file for the same `type` supersedes the
 * previous one and resets the status to `pending`. The returned row IS the
 * answer, so it replaces its predecessor in the cached list; and because
 * that status decides whether the car may be published, the fleet rows
 * (which carry `registration`) go stale with it.
 */
export function useUploadCarDocument(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; type: string }) =>
      agencyService.uploadCarDocument(carId, input.file, input.type),
    onSuccess: (document) => {
      qc.setQueryData<CarDocumentDto[]>(
        agencyKeys.carDocuments(carId),
        (prev) => [
          ...(prev ?? []).filter((d) => d.type !== document.type),
          document,
        ],
      );
      void qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() });
    },
  });
}

// ── Car photos ──────────────────────────────────────────────────────────────

export function useCarPhotos(carId: string) {
  return useQuery({
    queryKey: agencyKeys.carPhotos(carId),
    queryFn: () => agencyService.carPhotos(carId),
    enabled: !!carId,
  });
}

/**
 * The gallery AND every card's `primaryPhoto` move together, so the whole
 * agency subtree is refreshed rather than the gallery alone.
 */
function invalidateCarPhotos(qc: QueryClient, carId: string): Promise<void> {
  return Promise.all([
    qc.invalidateQueries({ queryKey: agencyKeys.carPhotos(carId) }),
    qc.invalidateQueries({ queryKey: agencyKeys.all }),
  ]).then(() => undefined);
}

export function useDeleteCarPhoto(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      agencyService.deleteCarPhoto(carId, photoId),
    // `onSettled`: a failed delete may still have landed server-side, and a
    // gallery that disagrees with the server is worse than a wasted refetch.
    onSettled: () => invalidateCarPhotos(qc, carId),
  });
}

export function useReorderCarPhotos(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoIds: string[]) =>
      agencyService.reorderCarPhotos(carId, photoIds),
    onSuccess: (gallery) => {
      // The response IS the new order — no refetch can say more.
      qc.setQueryData(agencyKeys.carPhotos(carId), gallery);
      void qc.invalidateQueries({ queryKey: agencyKeys.all });
    },
    onError: () => {
      // A stale set 400s (concurrent change) — refetch the truth.
      void qc.invalidateQueries({ queryKey: agencyKeys.carPhotos(carId) });
    },
  });
}

/**
 * Upload gallery files one by one. Never rejects per file — each outcome is
 * reported through `onProgress`; resolves with how many landed.
 */
export function useUploadCarPhotos(carId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      files: File[];
      onProgress: (update: PhotoUploadProgress) => void;
    }) =>
      agencyService.uploadCarPhotosSequentially(
        carId,
        input.files,
        input.onProgress,
      ),
    onSuccess: () => invalidateCarPhotos(qc, carId),
  });
}

// ── Calendar ────────────────────────────────────────────────────────────────

/**
 * One month of occupancy (bookings + manual blocks). Keyed by the agency and
 * the caller's branch scope as well as the filters: a reassignment must not
 * serve the previous scope's entries from cache. Idle until the scope is
 * known — an unknown scope is a closed one.
 */
export function useAgencyCalendar(
  carId: string | null,
  month: string,
  enabled = true,
) {
  const session = useAgencySession();
  const scope = session.isError
    ? undefined
    : session.data?.membership.branchScope;
  return useQuery({
    queryKey: [
      ...agencyKeys.calendar(carId, month),
      session.data?.agency.id,
      scope,
    ],
    queryFn: () => agencyService.calendar(carId, month),
    enabled: enabled && Boolean(scope),
  });
}

/** Refresh one month of the calendar (the caller knows which it is showing). */
export function useInvalidateAgencyCalendar(
  carId: string | null,
  month: string,
): () => void {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: agencyKeys.calendar(carId, month) });
  }, [qc, carId, month]);
}

/**
 * Block dates an offline rental occupies. The row lands in CarOccupancy, so
 * the DB exclusion constraint — not this app — is what rejects an overlap
 * (expect a 409). `assertInScope` is the caller's presentation-side check
 * that the chosen car is one it may touch; throwing there surfaces as the
 * mutation's error, and the API enforces the real scope either way.
 *
 * Deliberately invalidates NOTHING: only the caller knows which month and
 * car the calendar is showing, so it owns the refresh.
 */
export function useCreateManualBlock(
  assertInScope: (input: ManualBlockInput) => void = () => undefined,
) {
  return useMutation({
    mutationFn: (input: ManualBlockInput) => {
      assertInScope(input);
      return agencyService.createManualBlock(input);
    },
  });
}

/** See `useCreateManualBlock` for what `assertInScope` is for. */
export function useDeleteManualBlock(
  carId: string | null,
  month: string,
  assertInScope: (blockId: string) => void = () => undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => {
      assertInScope(blockId);
      return agencyService.deleteManualBlock(blockId);
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.calendar(carId, month) }),
  });
}

// ── Requests (the inbox) ────────────────────────────────────────────────────

export function useAgencyRequests(filters: RequestFilters = {}) {
  return useQuery({
    queryKey: agencyKeys.requests(filters),
    queryFn: () => agencyService.requests(filters),
  });
}

/**
 * The AGENCY view of one booking (carries `customer` and `agreement`, never
 * `payment`). Keyed under `bookings` — the same entry the customer's detail
 * uses, so one invalidation refreshes both sides.
 */
export function useAgencyBookingDetail(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: () => agencyService.bookingDetail(bookingId),
    enabled: !!bookingId,
  });
}

/**
 * Accepting captures the payment and inserts the occupancy row in ONE
 * server transaction, so everything the inbox shows can move at once.
 */
export function useAcceptRequest(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.acceptRequest(bookingId),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

export function useRejectRequest(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      agencyService.rejectRequest(bookingId, reason),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

/**
 * Nudge the renter about their missing documents.
 *
 * The response carries a refreshed `renterDocuments` (the cooldown the
 * button reads), but it is a plain `Booking` while the cache holds a
 * `BookingDetail` — so the booking is refetched rather than patched from a
 * narrower shape. The refresh also runs on a REFUSAL: a 409 means our copy
 * of `renterDocuments` is the stale one (somebody else just reminded, or the
 * renter uploaded in the meantime), which is exactly when the button must
 * stop offering.
 *
 * The invalidation is RETURNED, not fired and forgotten: v5 keeps the
 * mutation pending until a promise returned from `onSettled` settles, so the
 * button stays disabled until the new cooldown has actually landed. Dropping
 * the promise re-enables it for one round trip still showing the pre-click
 * `nextReminderAt` — and a second click in that window answers 409, which
 * would report a failure for a reminder the renter did receive.
 */
export function useRemindRenterDocuments(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.remindRenterDocuments(bookingId),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: agencyKeys.all }),
        qc.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) }),
      ]),
  });
}

export function useConfirmHandover(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      agencyService.confirmHandover(bookingId, code),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

export function usePickupRequest(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.pickupRequest(bookingId),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

export function useReturnRequest(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.returnRequest(bookingId),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

export function useSettleRequest(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.settleRequest(bookingId),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
    onError: (error) => {
      // Already finalized — our copy of the booking is the stale one.
      if (
        isApiErrorCode(error, API_ERROR_CODES.SETTLEMENT_ALREADY_FINALIZED)
      ) {
        invalidateAgencyBooking(qc, bookingId);
      }
    },
  });
}

/** accepted → cancelled, before the rental starts. */
export function useCancelAgencyBooking(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      agencyService.cancelBooking(bookingId, reason),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

/** active → cancelled mid-rental (the car came back early / incident). */
export function useCancelActiveBooking(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      agencyService.cancelActiveBooking(bookingId, reason),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

/**
 * What cancelling this booking would cost, for the confirmation dialog.
 *
 * Fetched only while the dialog is OPEN (`enabled`): it is a question about
 * this instant — the cover rises on a clock — so asking it when nobody is
 * looking would cache an answer that quietly goes stale.
 */
export function useCancellationCover(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: agencyKeys.cancellationCover(bookingId),
    queryFn: () => agencyService.cancellationCover(bookingId),
    enabled,
    // The tiers turn on a date. A figure served from cache minutes later
    // can be the wrong one, and this one is a number somebody acts on.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useWalkInBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WalkInBookingInput) =>
      agencyService.walkInBooking(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.all }),
  });
}

// ── Inspections (ADR-0011) ──────────────────────────────────────────────────

/**
 * Check-in / check-out records of a booking with SIGNED media URLs (short
 * TTL — refetched after a minute so expired links are replaced before the
 * viewer needs them). `enabled` lets the panel skip the request until the
 * booking says a record exists.
 */
export function useAgencyInspections(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.inspections(bookingId),
    queryFn: () => agencyService.inspections(bookingId),
    staleTime: 60_000,
    enabled: enabled && !!bookingId,
  });
}

/** Opening a check-in draft also starts the deposit hold. */
export function useCreateInspection(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInspectionInput) =>
      agencyService.createInspection(bookingId, input),
    onSuccess: (created) => {
      qc.setQueryData<InspectionDto[]>(
        agencyKeys.inspections(bookingId),
        (prev) => [...(prev ?? []).filter((i) => i.id !== created.id), created],
      );
      invalidateAgencyBooking(qc, bookingId);
    },
    onError: (error) => {
      // One already exists — our copy of the booking is the stale one.
      if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_EXISTS)) {
        invalidateAgencyBooking(qc, bookingId);
      }
    },
  });
}

/**
 * Save the draft's readings. The response carries the inspection WITHOUT its
 * media, so the cached row keeps the media it already has — otherwise saving
 * an odometer reading would blank the gallery the uploader just filled.
 *
 * Deliberately does not touch the booking: a draft edit moves nothing.
 */
export function useUpdateInspection(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      inspectionId: string;
      values: UpdateInspectionInput;
    }) => agencyService.updateInspection(input.inspectionId, input.values),
    onSuccess: (updated) => {
      qc.setQueryData<InspectionDto[]>(
        agencyKeys.inspections(bookingId),
        (prev) =>
          prev?.map((i) =>
            i.id === updated.id ? { ...updated, media: i.media } : i,
          ),
      );
    },
  });
}

/** Submitting hands the record to the customer and moves the booking. */
export function useSubmitInspection(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inspectionId: string) =>
      agencyService.submitInspection(inspectionId),
    onSuccess: (submitted) => {
      qc.setQueryData<InspectionDto[]>(
        agencyKeys.inspections(bookingId),
        (prev) => prev?.map((i) => (i.id === submitted.id ? submitted : i)),
      );
      invalidateAgencyBooking(qc, bookingId);
    },
    onError: (error) => {
      // Somebody finalized it first — refresh rather than argue.
      if (isApiErrorCode(error, API_ERROR_CODES.INSPECTION_WRONG_STATE)) {
        invalidateAgencyBooking(qc, bookingId);
      }
    },
  });
}

/** The customer is not there to confirm: finalize as `confirmed_absent`. */
export function useMarkCustomerAbsent(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { inspectionId: string; reason: string }) =>
      agencyService.markCustomerAbsent(input.inspectionId, input.reason),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
  });
}

// ── Damage claims (ADR-0013) ────────────────────────────────────────────────

/** Every claim filed on a booking (the current one + withdrawn history). */
export function useAgencyClaims(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.claims(bookingId),
    queryFn: () => agencyService.claims(bookingId),
    enabled: enabled && !!bookingId,
  });
}

export function useFileClaim(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FileClaimInput) =>
      agencyService.fileClaim(bookingId, input),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
    onError: (error) => {
      // A claim already exists — our copy of the booking is the stale one.
      if (isApiErrorCode(error, API_ERROR_CODES.CLAIM_EXISTS)) {
        invalidateAgencyBooking(qc, bookingId);
      }
    },
  });
}

/** Withdrawing an open claim releases the deposit hold. */
export function useWithdrawClaim(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (claimId: string) => agencyService.withdrawClaim(claimId),
    onSuccess: () => invalidateAgencyBooking(qc, bookingId),
    onError: (error) => {
      // No longer open — whoever closed it did so before us; refresh.
      if (isApiErrorCode(error, API_ERROR_CODES.CLAIM_NOT_OPEN)) {
        invalidateAgencyBooking(qc, bookingId);
      }
    },
  });
}

// ── Renter identity (ADR-0011) ──────────────────────────────────────────────

/**
 * Reveal the renter's licence, shared only from acceptance until the booking
 * settles. A MUTATION and not a query on purpose: EVERY read is logged for
 * the renter's "who saw my licence" audit, so it happens when a human asks
 * for it — never on mount, never from cache, never prefetched.
 */
export function useRevealRenterLicense(bookingId: string) {
  return useMutation({
    mutationFn: () => agencyService.renterLicense(bookingId),
  });
}

// ── Branches & zones ────────────────────────────────────────────────────────

export function useAgencyBranches(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.branches(),
    queryFn: () => agencyService.branches(),
    enabled,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBranchInput) =>
      agencyService.createBranch(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.branches() }),
  });
}

export function useUpdateBranch(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBranchInput) =>
      agencyService.updateBranch(branchId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.branches() }),
  });
}

export function useAgencyZones(branchId: string, enabled = true) {
  return useQuery({
    queryKey: agencyKeys.zones(branchId),
    queryFn: () => agencyService.zones(branchId),
    enabled: enabled && !!branchId,
  });
}

export function useCreateZone(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateZoneInput) =>
      agencyService.createZone(branchId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.zones(branchId) }),
  });
}

export function useDeleteZone(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (zoneId: string) => agencyService.deleteZone(zoneId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.zones(branchId) }),
  });
}

// ── Wallet, earnings & payouts ──────────────────────────────────────────────

export function useAgencyWallet(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.wallet(),
    queryFn: () => agencyService.wallet(),
    enabled,
  });
}

export function useAgencyEarnings(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.earnings(),
    queryFn: () => agencyService.earnings(),
    enabled,
  });
}

export function useAgencyPayouts(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.payouts(),
    queryFn: () => agencyService.payouts(),
    enabled,
  });
}

/**
 * Ask for a bank transfer. Both the balance and the payout list move —
 * including on failure: a 409 INSUFFICIENT_BALANCE means our copy of the
 * balance is the stale one.
 */
export function useRequestPayout() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: agencyKeys.wallet() });
    void qc.invalidateQueries({ queryKey: agencyKeys.payouts() });
  };
  return useMutation({
    mutationFn: (amountCents: number) =>
      agencyService.requestPayout(amountCents),
    onSuccess: refresh,
    onError: refresh,
  });
}

export function usePayoutAccount(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.payoutAccount(),
    queryFn: () => agencyService.payoutAccount(),
    enabled,
  });
}

/**
 * Mint the Stripe-hosted onboarding link. Single-use and ~10 minutes long,
 * so it is fetched on click and never cached.
 */
export function usePayoutOnboardingLink() {
  return useMutation({
    mutationFn: () => agencyService.payoutAccountOnboardingLink(),
  });
}

/** Re-read the recipient from Stripe (status, requirements, bank last4). */
export function useSyncPayoutAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.syncPayoutAccount(),
    onSuccess: (account) => {
      qc.setQueryData<PayoutAccountDto>(agencyKeys.payoutAccount(), account);
      // The wallet DTO embeds `payoutAccount` too.
      void qc.invalidateQueries({ queryKey: agencyKeys.wallet() });
    },
  });
}

// ── Settings & branding ─────────────────────────────────────────────────────

export function useAgencySettings(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.settings(),
    queryFn: () => agencyService.settings(),
    enabled,
  });
}

/**
 * The response IS the saved settings, so it replaces the cached copy; the
 * name, logo and conditions also surface on the session banner and the
 * public pages, which is why the session goes with it.
 */
export function useUpdateAgencySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAgencySettingsInput) =>
      agencyService.updateSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData(agencyKeys.settings(), settings);
      void qc.invalidateQueries({ queryKey: agencyKeys.session() });
    },
  });
}

/** The logo / banner upload answers with the updated settings. */
export function useUploadBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: "logo" | "banner";
      file: File;
      onProgress?: (pct: number) => void;
    }) =>
      agencyService.uploadBranding(input.kind, input.file, input.onProgress),
    onSuccess: (settings) => {
      qc.setQueryData(agencyKeys.settings(), settings);
      // Logo/banner surface on the session banner and public pages.
      void qc.invalidateQueries({ queryKey: agencyKeys.session() });
    },
  });
}

// ── Host agreement (ADR-0010) ───────────────────────────────────────────────

export function useHostAgreement(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.hostAgreement(),
    queryFn: () => agencyService.hostAgreement(),
    enabled,
  });
}

/**
 * Click-to-sign. The returned document is written straight into the cached
 * status (it IS the answer — no refetch can say more), and signing is what
 * unblocks publishing a car, so the session (`hostAgreementSigned`) and the
 * fleet gates move with it.
 */
export function useSignHostAgreement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignContractInput) =>
      agencyService.signHostAgreement(input),
    onSuccess: (document) => {
      qc.setQueryData<HostAgreementStatusDto>(
        agencyKeys.hostAgreement(),
        (prev) =>
          prev ? { ...prev, signed: document, resignRequired: false } : prev,
      );
      void qc.invalidateQueries({ queryKey: agencyKeys.session() });
      void qc.invalidateQueries({ queryKey: agencyKeys.fleetAll() });
    },
  });
}

/**
 * Open the host's signed PDF. The link is short-lived and minted on click —
 * never cached, or the next click gets a dead URL.
 */
export function useOpenHostAgreementPdf() {
  return useOpenSignedUrl(() => agencyService.hostAgreementPdf());
}

// ── Staff (RBAC) ────────────────────────────────────────────────────────────

export function useAgencyStaff(enabled = true) {
  return useQuery({
    queryKey: agencyKeys.staff(),
    queryFn: () => agencyService.staff(),
    enabled,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => agencyService.createStaff(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.staff() }),
  });
}

export function useUpdateStaff(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffInput) =>
      agencyService.updateStaff(userId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.staff() }),
  });
}

export function useRemoveStaff(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => agencyService.removeStaff(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: agencyKeys.staff() }),
  });
}
