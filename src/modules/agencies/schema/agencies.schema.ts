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

export const agencyVerificationStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
  "suspended",
]);

/** `GET /agencies/:slug`. */
export const agencyPublicProfileWireSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
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
  name: z.string(),
  description: z.string().optional(),
  legalName: z.string(),
  taxId: z.string(),
  ownerName: z.string(),
  ownerIdNumber: z.string(),
  phone: z.string(),
  address: z.string(),
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
