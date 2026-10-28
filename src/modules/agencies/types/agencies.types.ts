import type { z } from "zod";
import type { CarSearchFilters } from "@/modules/cars/types/cars.types";
import type {
  agencyApplicationWireSchema,
  agencyDocumentTypeSchema,
  agencyDocumentWireSchema,
  agencyKycWireSchema,
  agencyPublicProfileWireSchema,
  applyAgencyInputSchema,
  applyIndividualHostInputSchema,
  createReviewInputSchema,
  publicBranchWireSchema,
  reviewWireSchema,
} from "@/modules/agencies/schema/agencies.schema";
import type {
  hostAddressSchema,
  hostPersonalSchema,
} from "@/modules/agencies/schema/host.schema";

/**
 * Agency types — every wire/input/form type is the `z.infer` of a schema in
 * `../schema`. The three FILTER shapes below are the exception on purpose:
 * they describe the URL, not a response, and they extend the car search
 * filters the storefront reuses verbatim.
 */

// ------------------------------------------------------------- wire contract

export type PublicBranch = z.infer<typeof publicBranchWireSchema>;
export type AgencyPublicProfile = z.infer<
  typeof agencyPublicProfileWireSchema
>;
export type Review = z.infer<typeof reviewWireSchema>;
export type AgencyDocument = z.infer<typeof agencyDocumentWireSchema>;
export type AgencyDocumentType = z.infer<typeof agencyDocumentTypeSchema>;
export type AgencyKyc = z.infer<typeof agencyKycWireSchema>;
export type AgencyApplication = z.infer<typeof agencyApplicationWireSchema>;

// -------------------------------------------------------------- service input

export type ApplyAgencyInput = z.infer<typeof applyAgencyInputSchema>;
export type ApplyIndividualHostInput = z.infer<
  typeof applyIndividualHostInputSchema
>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

// --------------------------------------------------------------- form values

export type HostPersonalValues = z.infer<typeof hostPersonalSchema>;
export type HostAddressValues = z.infer<typeof hostAddressSchema>;

// ------------------------------------------------------------------- filters

export type AgencyCarsSort = "price_asc" | "price_desc" | "year_desc";

/**
 * Agency storefront catalog filters. These are the SAME faceted filters as
 * the car search (make/model catalog slugs, year range, specs, price/day) —
 * so the storefront reuses the exact `CarFiltersPanel` — plus a catalog
 * `sort`. There is no date range (a storefront is a catalog, not an
 * availability search).
 */
export interface AgencyCarsFilters extends CarSearchFilters {
  /** Show only cars at this branch/location. */
  branchId?: string;
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
