import { Api } from "@/shared/api/client";
import type { Car, City, Paginated } from "@/shared/types/domain";
import { agencyCarsParams } from "@/modules/cars/helpers/cars.helper";
import {
  agencyApplicationWireSchema,
  agencyDocumentListWireSchema,
  agencyDocumentWireSchema,
  agencyPublicProfileWireSchema,
  applyAgencyInputSchema,
  applyIndividualHostInputSchema,
  cityListWireSchema,
  createReviewInputSchema,
  paginatedAgencyProfileWireSchema,
  paginatedCarWireSchema,
  paginatedReviewWireSchema,
  reviewWireSchema,
} from "@/modules/agencies/schema/agencies.schema";
import type {
  AgencyApplication,
  AgencyCarsFilters,
  AgencyDirectoryFilters,
  AgencyDocument,
  AgencyDocumentType,
  AgencyPublicProfile,
  ApplyAgencyInput,
  ApplyIndividualHostInput,
  CreateReviewInput,
  Review,
} from "@/modules/agencies/types/agencies.types";

/**
 * Public agency storefront + application/KYC API client — the ONLY thing in
 * the module that talks to the backend. Hooks call these, components call
 * hooks.
 *
 * This is the PUBLIC storefront, distinct from the private `/agency`
 * dashboard (`modules/agency`), which is RBAC-scoped to the caller.
 *
 *  - GET  /agencies/:slug                  -> AgencyPublicProfile
 *  - GET  /agencies/:slug/cars             -> Paginated<Car>
 *      query: make/model/year/color/category/transmission/
 *             priceMinCents/priceMaxCents/page/pageSize/sort
 *  - GET  /agencies                        -> Paginated<AgencyPublicProfile>
 *  - GET  /agencies/available-cities       -> City[]
 *  - GET  /agencies/:slug/reviews?page=    -> Paginated<Review>
 *  - GET  /bookings/:bookingId/review      -> Review | null
 *  - POST /reviews                         -> Review
 *  - POST /agencies/apply                  -> AgencyApplication
 *  - POST /agencies/apply-individual       -> AgencyApplication  (ADR-0009)
 *  - POST /agencies/documents (multipart)  -> AgencyDocument
 *  - GET  /agencies/my-documents           -> AgencyDocument[]
 *  - GET  /agencies/applications/:agencyId -> AgencyApplication
 */
class AgenciesService {
  async profile(slug: string): Promise<AgencyPublicProfile> {
    const res = await Api.get<unknown>(
      `/agencies/${encodeURIComponent(slug)}`,
    );
    return agencyPublicProfileWireSchema.parse(res.data);
  }

  async cars(
    slug: string,
    filters: AgencyCarsFilters,
  ): Promise<Paginated<Car>> {
    const res = await Api.get<unknown>(
      `/agencies/${encodeURIComponent(slug)}/cars`,
      { params: agencyCarsParams(filters) },
    );
    return paginatedCarWireSchema.parse(res.data);
  }

  // ── Application & KYC ──

  async apply(input: ApplyAgencyInput): Promise<AgencyApplication> {
    const body = applyAgencyInputSchema.parse(input);
    const res = await Api.post<unknown>("/agencies/apply", body);
    return agencyApplicationWireSchema.parse(res.data);
  }

  /**
   * Individual-host application (ADR-0009): ONE transaction creates the
   * `kind=individual` agency + its "Home" branch and links the caller as
   * owner. 409 when the user already owns an agency.
   */
  async applyIndividual(
    input: ApplyIndividualHostInput,
  ): Promise<AgencyApplication> {
    const body = applyIndividualHostInputSchema.parse(input);
    const res = await Api.post<unknown>("/agencies/apply-individual", body);
    return agencyApplicationWireSchema.parse(res.data);
  }

  /** Multipart: the file is a `File`, so only the response is parsed. */
  async uploadDocument(
    file: File,
    type: AgencyDocumentType,
  ): Promise<AgencyDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post<unknown>("/agencies/documents", form);
    return agencyDocumentWireSchema.parse(res.data);
  }

  async myDocuments(): Promise<AgencyDocument[]> {
    const res = await Api.get<unknown>("/agencies/my-documents");
    return agencyDocumentListWireSchema.parse(res.data);
  }

  /**
   * The caller's OWN application file (shared with the admin review screen).
   * Authorized by ownership server-side: `agency_staff` and anyone else's
   * file answer 403, and the route sits OUTSIDE the agency access gate on
   * purpose — a `pending` applicant and a `rejected` ex-applicant are
   * precisely who must be able to read it.
   */
  async application(agencyId: string): Promise<AgencyApplication> {
    const res = await Api.get<unknown>(
      `/agencies/applications/${encodeURIComponent(agencyId)}`,
    );
    return agencyApplicationWireSchema.parse(res.data);
  }

  // ── Directory & reviews ──

  async directory(
    filters: AgencyDirectoryFilters = {},
  ): Promise<Paginated<AgencyPublicProfile>> {
    const res = await Api.get<unknown>("/agencies", {
      params: {
        city: filters.city || undefined,
        sort: filters.sort,
        page: filters.page,
      },
    });
    return paginatedAgencyProfileWireSchema.parse(res.data);
  }

  /** Cities that actually have available cars (drives the search dropdown). */
  async availableCities(): Promise<City[]> {
    const res = await Api.get<unknown>("/agencies/available-cities");
    return cityListWireSchema.parse(res.data);
  }

  async reviews(slug: string, page = 1): Promise<Paginated<Review>> {
    const res = await Api.get<unknown>(
      `/agencies/${encodeURIComponent(slug)}/reviews`,
      { params: { page } },
    );
    return paginatedReviewWireSchema.parse(res.data);
  }

  /** The caller's own review for a booking (null → they can still rate it). */
  async reviewForBooking(bookingId: string): Promise<Review | null> {
    const res = await Api.get<unknown>(
      `/bookings/${encodeURIComponent(bookingId)}/review`,
    );
    return res.data === null ? null : reviewWireSchema.parse(res.data);
  }

  async createReview(input: CreateReviewInput): Promise<Review> {
    const body = createReviewInputSchema.parse(input);
    const res = await Api.post<unknown>("/reviews", body);
    return reviewWireSchema.parse(res.data);
  }
}

export const agenciesService = new AgenciesService();
