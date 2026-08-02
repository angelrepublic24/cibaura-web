import { Api } from "@/shared/api/client";
import type { AgencyVerificationStatus, Car, Paginated } from "@/shared/types/domain";
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
}

export type AgencyCarsSort = "price_asc" | "price_desc" | "year_desc";

/** Filters for the agency storefront grid (whole units in UI, cents on wire). */
export interface AgencyCarsFilters {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  category?: string;
  transmission?: string;
  /** Per-day price bounds in WHOLE currency units (URL-friendly). */
  priceMin?: number;
  priceMax?: number;
  sort?: AgencyCarsSort;
  page?: number;
  pageSize?: number;
}

export const agencyProfileKeys = {
  all: ["agency-profile"] as const,
  profile: (slug: string) => ["agency-profile", slug] as const,
  cars: (slug: string, filters: AgencyCarsFilters) =>
    ["agency-profile", slug, "cars", filters] as const,
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
        year: filters.year,
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
};
