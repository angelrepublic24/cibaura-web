import { Api } from "@/shared/api/client";
import type { AgencyVerificationStatus, Car, Paginated } from "@/shared/types/domain";
import type { CarSearchFilters } from "@/features/cars/filters";
import { wholeUnitsToCents } from "@/shared/utils/money";

/**
 * Public agency storefront API (no auth).
 *
 * Backend contract (being built in parallel — code to these shapes):
 *  - GET /agencies/:slug        -> AgencyPublicProfile
 *  - GET /agencies/:slug/cars   -> Paginated<Car>
 *      query: make/model/year/color/category/transmission/
 *             priceMinCents/priceMaxCents/page/pageSize/sort
 *      sort ∈ price_asc | price_desc | year_desc
 *
 * This is the PUBLIC storefront — distinct from the private `/agency`
 * dashboard (features/agency/api.ts), which is RBAC-scoped to the caller.
 */

export interface AgencyPublicProfile {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  verificationStatus: AgencyVerificationStatus;
  cities: { id: string; name: string }[];
  branchCount: number;
  carCount: number;
  /** Average star rating (0 when no reviews) + how many. */
  ratingAvg: number;
  reviewCount: number;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  reviewerName: string;
  createdAt: string;
}

export type AgencyCarsSort = "price_asc" | "price_desc" | "year_desc";

/**
 * Agency storefront catalog filters. These are the SAME faceted filters as the
 * car search (make/model catalog slugs, year range, specs, price/day) — so the
 * storefront reuses the exact `CarFiltersPanel` — plus a catalog `sort`. There
 * is no date range (a storefront is a catalog, not an availability search).
 */
export interface AgencyCarsFilters extends CarSearchFilters {
  sort?: AgencyCarsSort;
  pageSize?: number;
}

/** How the agency directory is ordered. */
export type AgencyDirectorySort = "top_rated" | "most_reviews" | "name";

/** Agency directory search filters — URL-driven, like the car search. */
export interface AgencyDirectoryFilters {
  city?: string;
  sort?: AgencyDirectorySort;
  page?: number;
}

export const agencyProfileKeys = {
  all: ["agency-profile"] as const,
  directory: (filters: AgencyDirectoryFilters) =>
    ["agency-directory", filters] as const,
  profile: (slug: string) => ["agency-profile", slug] as const,
  cars: (slug: string, filters: AgencyCarsFilters) =>
    ["agency-profile", slug, "cars", filters] as const,
  reviews: (slug: string, page: number) =>
    ["agency-profile", slug, "reviews", page] as const,
  reviewForBooking: (bookingId: string) =>
    ["review", "booking", bookingId] as const,
};

// ── Application & KYC (ADR-0004) ─────────────────────────────────────────────

export type AgencyDocumentType = "business_registration" | "owner_id" | "other";

export interface AgencyDocument {
  id: string;
  type: string;
  filename: string;
  contentType: string;
  uploadedAt: string;
}

export interface AgencyKyc {
  legalName: string | null;
  taxId: string | null;
  ownerName: string | null;
  ownerIdNumber: string | null;
  phone: string | null;
  address: string | null;
}

export interface AgencyApplication {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  verificationStatus: AgencyVerificationStatus;
  verificationReason: string | null;
  kyc: AgencyKyc;
  documents: AgencyDocument[];
  documentCount: number;
  createdAt: string;
}

export interface ApplyAgencyInput {
  name: string;
  description?: string;
  legalName: string;
  taxId: string;
  ownerName: string;
  ownerIdNumber: string;
  phone: string;
  address: string;
}

export const applyKeys = {
  myDocuments: () => ["agency-apply", "my-documents"] as const,
};

export const AgenciesApi = {
  async profile(slug: string): Promise<AgencyPublicProfile> {
    const res = await Api.get(`/agencies/${slug}`);
    return res.data;
  },

  async cars(
    slug: string,
    filters: AgencyCarsFilters,
  ): Promise<Paginated<Car>> {
    const res = await Api.get(`/agencies/${slug}/cars`, {
      params: {
        make: filters.make,
        model: filters.model,
        yearMin: filters.yearMin,
        yearMax: filters.yearMax,
        color: filters.color,
        category: filters.category,
        transmission: filters.transmission,
        // URL keeps whole units for humans; the API filters on cents.
        priceMinCents:
          filters.priceMin !== undefined
            ? wholeUnitsToCents(filters.priceMin)
            : undefined,
        priceMaxCents:
          filters.priceMax !== undefined
            ? wholeUnitsToCents(filters.priceMax)
            : undefined,
        sort: filters.sort,
        page: filters.page,
        pageSize: filters.pageSize,
      },
    });
    return res.data;
  },

  // ── Application & KYC ──

  async apply(input: ApplyAgencyInput): Promise<AgencyApplication> {
    const res = await Api.post("/agencies/apply", input);
    return res.data;
  },

  async uploadDocument(
    file: File,
    type: AgencyDocumentType,
  ): Promise<AgencyDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await Api.post("/agencies/documents", form);
    return res.data;
  },

  async myDocuments(): Promise<AgencyDocument[]> {
    const res = await Api.get("/agencies/my-documents");
    return res.data;
  },

  // ── Directory & reviews ──

  async directory(
    filters: AgencyDirectoryFilters = {},
  ): Promise<Paginated<AgencyPublicProfile>> {
    const res = await Api.get("/agencies", {
      params: {
        city: filters.city || undefined,
        sort: filters.sort,
        page: filters.page,
      },
    });
    return res.data;
  },

  async reviews(
    slug: string,
    page = 1,
  ): Promise<Paginated<Review>> {
    const res = await Api.get(`/agencies/${slug}/reviews`, {
      params: { page },
    });
    return res.data;
  },

  /** The caller's own review for a booking (null → they can still rate it). */
  async reviewForBooking(bookingId: string): Promise<Review | null> {
    const res = await Api.get(`/bookings/${bookingId}/review`);
    return res.data;
  },

  async createReview(input: {
    bookingId: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const res = await Api.post("/reviews", input);
    return res.data;
  },
};
