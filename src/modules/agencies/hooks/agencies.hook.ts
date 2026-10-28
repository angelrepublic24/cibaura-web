import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { agenciesService } from "@/modules/agencies/services/agencies.service";
import type {
  AgencyCarsFilters,
  AgencyDirectoryFilters,
  AgencyDocumentType,
  ApplyAgencyInput,
  ApplyIndividualHostInput,
  CreateReviewInput,
} from "@/modules/agencies/types/agencies.types";

/**
 * Query keys for the agencies module. Two families, deliberately separate:
 * the PUBLIC storefront (`agency-profile`, `agency-directory`) and the
 * caller's own APPLICATION file (`agency-apply`) — invalidating a review
 * must not blow away a KYC document list.
 */
export const agencyProfileKeys = {
  all: ["agency-profile"] as const,
  directory: (filters: AgencyDirectoryFilters) =>
    ["agency-directory", filters] as const,
  availableCities: () => ["agency-available-cities"] as const,
  profile: (slug: string) => ["agency-profile", slug] as const,
  cars: (slug: string, filters: AgencyCarsFilters) =>
    ["agency-profile", slug, "cars", filters] as const,
  reviews: (slug: string, page: number) =>
    ["agency-profile", slug, "reviews", page] as const,
  reviewForBooking: (bookingId: string) =>
    ["review", "booking", bookingId] as const,
};

export const applyKeys = {
  myDocuments: () => ["agency-apply", "my-documents"] as const,
  application: (agencyId: string) =>
    ["agency-apply", "application", agencyId] as const,
};

// ── Public storefront ───────────────────────────────────────────────────────

export function useAgencyDirectory(filters: AgencyDirectoryFilters) {
  return useQuery({
    queryKey: agencyProfileKeys.directory(filters),
    queryFn: () => agenciesService.directory(filters),
  });
}

/**
 * Cities that actually have available cars. `staleTime` is the caller's
 * because the footer keeps it for five minutes while the directory filter
 * wants it fresh.
 */
export function useAvailableCities(staleTime?: number) {
  return useQuery({
    queryKey: agencyProfileKeys.availableCities(),
    queryFn: () => agenciesService.availableCities(),
    staleTime,
  });
}

export function useAgencyProfile(slug: string) {
  return useQuery({
    queryKey: agencyProfileKeys.profile(slug),
    queryFn: () => agenciesService.profile(slug),
  });
}

export function useAgencyCars(slug: string, filters: AgencyCarsFilters) {
  return useQuery({
    queryKey: agencyProfileKeys.cars(slug, filters),
    queryFn: () => agenciesService.cars(slug, filters),
  });
}

export function useAgencyReviews(slug: string, page: number) {
  return useQuery({
    queryKey: agencyProfileKeys.reviews(slug, page),
    queryFn: () => agenciesService.reviews(slug, page),
  });
}

/** The caller's own review for a booking (null → they can still rate it). */
export function useReviewForBooking(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: agencyProfileKeys.reviewForBooking(bookingId),
    queryFn: () => agenciesService.reviewForBooking(bookingId),
    enabled,
  });
}

/**
 * Posting a review changes the agency's aggregate rating everywhere it is
 * shown, so the whole storefront subtree is refreshed, not just the one
 * review list.
 */
export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReviewInput) =>
      agenciesService.createReview(input),
    onSuccess: (_review, input) => {
      // The agency's storefront aggregate moved...
      void qc.invalidateQueries({ queryKey: agencyProfileKeys.all });
      // ...and this booking's own review row now exists (it lives outside
      // the storefront subtree, so it needs its own nudge).
      void qc.invalidateQueries({
        queryKey: agencyProfileKeys.reviewForBooking(input.bookingId),
      });
    },
  });
}

// ── Application & KYC ───────────────────────────────────────────────────────

export function useApplyAgency() {
  return useMutation({
    mutationFn: (input: ApplyAgencyInput) => agenciesService.apply(input),
  });
}

export function useApplyIndividualHost() {
  return useMutation({
    mutationFn: (input: ApplyIndividualHostInput) =>
      agenciesService.applyIndividual(input),
  });
}

export function useMyAgencyDocuments() {
  return useQuery({
    queryKey: applyKeys.myDocuments(),
    queryFn: () => agenciesService.myDocuments(),
  });
}

export function useUploadAgencyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; type: AgencyDocumentType }) =>
      agenciesService.uploadDocument(input.file, input.type),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: applyKeys.myDocuments() }),
  });
}

/**
 * The caller's own application file, authorized by ownership server-side.
 *
 * Never retried: `agency_staff` of a pending agency gets a 403, and a 403 is
 * a verdict, not a blip — retrying it only delays the "could not load" note
 * the screen degrades to.
 */
export function useAgencyApplication(agencyId: string, staleTime?: number) {
  return useQuery({
    queryKey: applyKeys.application(agencyId),
    queryFn: () => agenciesService.application(agencyId),
    staleTime,
    retry: false,
  });
}
