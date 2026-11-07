import { z } from "zod";
import { carWireSchema, paginatedWireSchema } from "@/shared/api/wire";

/**
 * Public agency storefront + application/KYC wire schemas (zod v4).
 *
 * This is the PUBLIC storefront contract — distinct from the private
 * `/agency` dashboard, which is RBAC-scoped to the caller. `AgenciesService`
 * validates every response against these; the `z.infer` types live in
 * `../types/agencies.types`.
 */

/** Privacy-safe public branch: identity + city only (no address/coords). */
export const publicBranchWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.object({ id: z.string(), name: z.string() }).nullable(),
});

export const agencyKindSchema = z.enum(["business", "individual"]);

/**
 * Closed on purpose, unlike the app's `z.string()`: four shapes consume this
 * and the admin console renders a badge per value, so a status nobody decided
 * what to do with should fail loudly here rather than silently draw itself as
 * "Pending". `closed` is the terminal one — the owner retired the business
 * when they deleted their account (backend `AgencyVerificationStatus.CLOSED`).
 */
export const agencyVerificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
  "suspended",
  "closed",
]);

/** `GET /agencies/:slug`. */
export const agencyPublicProfileWireSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  /* `.nullish()` for the same reason as in `modules/agency/schema`: the server
     sends `string | null`, and `.optional()` rejects null in zod 4. This one is
     the PUBLIC schema — `/agencies/:slug` and the `/agencies` directory — so
     the failure was not limited to the owner's console: one verified agency
     without a logo turned the directory into "Could not load agencies" for
     every visitor on any client-side refetch (changing city, paging, or coming
     back to the tab after the query went stale). */
  description: z.string().nullish(),
  logoUrl: z.string().nullish(),
  /** Storefront cover image; null/absent = gradient. */
  bannerUrl: z.string().nullish(),
  verificationStatus: agencyVerificationStatusSchema,
  cities: z.array(z.object({ id: z.string(), name: z.string() })),
  /** Active branches for the storefront location picker. */
  branches: z.array(publicBranchWireSchema),
  branchCount: z.number(),
  carCount: z.number(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  rentalConditions: z.string().nullable(),
  minDriverAge: z.number(),
  depositNote: z.string().nullable(),
  /** `business | individual` — drives the "Private host" badge. */
  kind: agencyKindSchema,
});

export const reviewWireSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string().nullable(),
  reviewerName: z.string(),
  createdAt: z.string(),
});

export const cityWireSchema = z.object({
  id: z.string(),
  countryId: z.string(),
  regionId: z.string().nullable(),
  name: z.string(),
  slug: z.string(),
});

// ── Application & KYC (ADR-0004 / ADR-0009) ─────────────────────────────────

/**
 * Entity KYC document types. `owner_id` is the FRONT of the owner's ID;
 * `owner_id_back` (individual hosts) the back of the same cédula.
 */
export const agencyDocumentTypeSchema = z.enum([
  "business_registration",
  "owner_id",
  "owner_id_back",
  "other",
]);

export const agencyDocumentWireSchema = z.object({
  id: z.string(),
  type: z.string(),
  filename: z.string(),
  contentType: z.string(),
  uploadedAt: z.string(),
});

export const agencyKycWireSchema = z.object({
  legalName: z.string().nullable(),
  taxId: z.string().nullable(),
  ownerName: z.string().nullable(),
  ownerIdNumber: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
});

export const agencyApplicationWireSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  verificationStatus: agencyVerificationStatusSchema,
  verificationReason: z.string().nullable(),
  /**
   * What the reviewer last asked this applicant for. Only ever present while
   * the application is PENDING: asking is not a decision, so the status does
   * not move, and a decision clears the request.
   */
  documentsRequested: z
    .object({ note: z.string(), requestedAt: z.string() })
    .nullable(),
  kyc: agencyKycWireSchema,
  documents: z.array(agencyDocumentWireSchema),
  documentCount: z.number(),
  createdAt: z.string(),
  kind: agencyKindSchema,
  /** Registration documents awaiting admin review across the applicant's cars. */
  carDocumentsPending: z.number(),
});

// ------------------------------------------------------------ input schemas

export const applyAgencyInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  legalName: z.string().trim().min(2).max(200),
  taxId: z.string().trim().min(3).max(40),
  ownerName: z.string().trim().min(2).max(200),
  ownerIdNumber: z.string().trim().min(3).max(40),
  phone: z.string().trim().min(5).max(32),
  address: z.string().trim().min(5).max(300),
  cityId: z.uuid(),
});

/**
 * `POST /agencies/apply-individual` (backend `ApplyIndividualHostDto`, spec
 * §4/B6). The cédula travels WITHOUT dashes; `dateOfBirth` is `YYYY-MM-DD`
 * and must be ≥ 18 years ago; the address becomes the host's single "Home"
 * branch (city + coordinates = pickup/delivery origin).
 */
export const applyIndividualHostInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  idType: z.string(),
  /**
   * WHO issued it: an ISO country code (`DO`) or a subdivision code
   * (`US-FL`). Always sent, even when the host was never asked — a Dominican
   * presenting a cédula sees no issuer question, because the cédula has
   * exactly one issuer, but a number cannot be validated without knowing the
   * authority behind it.
   */
  idIssuer: z.string(),
  idNumber: z.string(),
  dateOfBirth: z.string(),
  phone: z.string(),
  address: z.object({
    cityId: z.string(),
    line: z.string(),
    lat: z.number(),
    lng: z.number(),
    reference: z.string().optional(),
  }),
  acceptTerms: z.literal(true),
  termsVersion: z.string(),
});

export const createReviewInputSchema = z.object({
  bookingId: z.string(),
  rating: z.number(),
  comment: z.string().optional(),
});

// ---------------------------------------------------------- list responses

export const agencyDocumentListWireSchema = z.array(agencyDocumentWireSchema);
export const cityListWireSchema = z.array(cityWireSchema);
export const paginatedAgencyProfileWireSchema = paginatedWireSchema(
  agencyPublicProfileWireSchema,
);
export const paginatedReviewWireSchema = paginatedWireSchema(reviewWireSchema);
export const paginatedCarWireSchema = paginatedWireSchema(carWireSchema);
