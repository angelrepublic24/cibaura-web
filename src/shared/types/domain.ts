/**
 * Shared domain types — mirror of `docs/DOMAIN.md` (source of truth).
 * The integrator aligns these with the backend DTOs; keep field names
 * camelCase on the wire (backend maps snake_case columns).
 *
 * All money fields are INTEGER CENTS (invariant #4). Clients never
 * compute money — see `src/shared/utils/money.ts`.
 */

// ---------------------------------------------------------------- identity

export type Role = "customer" | "agency_owner" | "agency_staff" | "platform_admin";

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  roles: Role[];
  /** Present when the user owns/works for an agency. */
  agencyId?: string;
  /** `active | suspended | deleted` (wire `UserDto.status`). */
  status?: UserStatus;
  /** Terms version the user last accepted; null before any acceptance. */
  termsVersion?: string | null;
  createdAt: string;
}

/** `GET /users/me` (wire `UserDto`) — the serialized user, never the raw entity. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  roles: Role[];
  agencyId: string | null;
  isGuest: boolean;
  status: UserStatus;
  termsVersion: string | null;
  createdAt: string;
}

// --------------------------------------------------------------------- geo

export interface Country {
  id: string;
  name: string;
  code: string; // ISO-3166 alpha-2, e.g. "DO"
  /**
   * The country's own tax rate, or `null` when it has none of its own — which
   * means the PLATFORM rate applies, NOT that the market is tax-free. The
   * rate that reaches a booking is resolved from the CAR's country
   * (branch -> city -> country), never from where the renter is.
   */
  taxRatePct: number | null;
}

export interface Region {
  id: string;
  countryId: string;
  name: string;
  slug: string;
  code: string | null;
  kind: string;
}

export interface City {
  regionId: string | null;
  id: string;
  countryId: string;
  name: string;
  /** URL-safe slug used in routes: /cars/[city]. */
  slug: string;
}

// ------------------------------------------------ wire primitives (contract)

/** `{ id, name }` — the canonical lightweight reference the serializer emits. */
export interface NamedRef {
  id: string;
  name: string;
}

/**
 * Supply persona (ADR-0009): a rent-a-car `business` or an `individual`
 * host renting their own car(s). Both are the same `Agency` model; the kind
 * only changes onboarding, KYC documents and a few UI affordances.
 */
export type AgencyKind = "business" | "individual";

/**
 * Agency ref embedded in a `Car` — `NamedRef` plus the URL `slug`, so the
 * client builds the canonical `/agencies/:slug/cars/:id` detail link
 * (store-scoped product URL, Beusun-style) without re-deriving it from the name.
 * `kind` lets every list render the "Private host" badge.
 */
export interface CarAgencyRef {
  id: string;
  name: string;
  slug: string;
  kind: AgencyKind;
}

/** City reference embedded in `CarDetail.branch`. */
export interface CityRef {
  id: string;
  name: string;
}

/**
 * Rental period as it crosses the wire: both bounds are `YYYY-MM-DD`
 * date-only strings, checkout-style half-open `[start, end)` — the car is
 * free again ON `end`. The Postgres `daterange` literal never crosses the wire.
 */
export interface Period {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, exclusive
}

// ------------------------------------------------------------------ supply

export type AgencyVerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  verificationStatus: AgencyVerificationStatus;
  /** Set when the application was rejected — shown on the access-revoked screen. */
  verificationReason?: string | null;
  /** Free-text rental conditions the customer accepts at request time. */
  rentalConditions: string | null;
  minDriverAge: number;
  depositNote: string | null;
  createdAt: string;
  /** `business | individual` (ADR-0009). */
  kind: AgencyKind;
  /** Host agreement (ADR-0010): signed at least once / a newer template version asks for a new signature. */
  hostAgreementSigned: boolean;
  hostAgreementResignRequired: boolean;
}

export type PayoutAccountType = "checking" | "savings";

/** Bank account payouts are wired to — visible ONLY to `agency:settings` holders. */
export interface PayoutBankDetails {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  accountType: PayoutAccountType;
  currency: string;
}

/** `GET/PATCH /agency/settings` (wire `AgencySettingsDto`). */
export interface AgencySettings {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  rentalConditions: string | null;
  minDriverAge: number;
  depositNote: string | null;
  /**
   * The deposit cars inherit when they set none of their own, integer cents.
   * `null` = this agency has no default (such a car then asks for nothing),
   * `0` = the agency deliberately charges none, `> 0` = the amount.
   */
  defaultDepositCents: number | null;
  payoutBankDetails: PayoutBankDetails | null;
}

export interface Branch {
  id: string;
  agencyId: string;
  cityId: string;
  name: string;
  address: string;
  phone: string | null;
  /**
   * Opening hours as a `{ day: "HH:MM-HH:MM" }` map (matches the wire
   * `BranchDto.hours`), or `null` when unset. Free-text hours are not a v1
   * surface — the branches form omits this for now.
   */
  hours: Record<string, string> | null;
  isActive: boolean;
  /** Embedded city ref (`{ id, name }`) from the serializer, or null. */
  city: CityRef | null;
  /** Coordinates (delivery origin) + door-to-door delivery config. */
  lat: number | null;
  lng: number | null;
  deliveryEnabled: boolean;
  deliveryBaseFeeCents: number;
  deliveryPerKmCents: number;
  deliveryMaxKm: number | null;
}

/**
 * A branch delivery zone as the AGENCY sees it — `feeCents` is the host's own
 * figure. The renter's copy lives on `CarDetail.deliveryZones` and carries
 * `renterFeeCents` (the same fee with the platform commission folded in).
 */
export interface DeliveryZone {
  id: string;
  branchId: string;
  /** e.g. "Cibao Airport", "Hotel zone". */
  name: string;
  /** Fixed extra fee, integer cents; snapshotted into the booking. */
  feeCents: number;
}

/**
 * Agency-facing zone shape (`DeliveryZoneFullDto`): adds the `isActive` flag
 * the dashboard manages. Public `CarDetail.deliveryZones` only lists active
 * zones and omits it.
 */
export interface DeliveryZoneFull extends DeliveryZone {
  isActive: boolean;
}

export interface CatalogMake {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogModel {
  id: string;
  makeId: string;
  name: string;
  slug: string;
}

// Catalog enums MUST mirror the backend `car.entity.ts` enums exactly
// (docs/DOMAIN.md) — they are wire values the search facets filter on.
export const CAR_COLORS = [
  "white",
  "black",
  "gray",
  "silver",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "brown",
  "beige",
  "other",
] as const;
export type CarColor = (typeof CAR_COLORS)[number];

export const CAR_CATEGORIES = [
  "sedan",
  "suv",
  "pickup",
  "van",
  "hatchback",
  "coupe",
  "convertible",
  "minivan",
  "luxury",
] as const;
export type CarCategory = (typeof CAR_CATEGORIES)[number];

export const TRANSMISSIONS = ["automatic", "manual"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const FUEL_TYPES = [
  "gasoline",
  "diesel",
  "hybrid",
  "electric",
  "lpg",
] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export type CarStatus = "draft" | "active" | "paused";

// Per-car documents (ADR-0009): the vehicle registration ("matrícula") an
// individual host must have verified before the car can go `active`.
export const CAR_DOCUMENT_STATUSES = ["pending", "verified", "rejected"] as const;
export type CarDocumentStatus = (typeof CAR_DOCUMENT_STATUSES)[number];
export const CAR_DOCUMENT_TYPE_REGISTRATION = "registration";

/** `GET/POST /agency/fleet/:carId/documents` (wire `CarDocumentDto`). */
export interface CarDocumentDto {
  id: string;
  type: typeof CAR_DOCUMENT_TYPE_REGISTRATION;
  status: CarDocumentStatus;
  filename: string;
  contentType: string;
  rejectionReason: string | null;
  uploadedAt: string;
  reviewedAt: string | null;
}

/** Admin review row (`GET /admin/cars/:carId/documents`). */
export interface CarDocumentAdminDto extends CarDocumentDto {
  carId: string;
  agencyId: string;
}

/**
 * Public car shape — the canonical `Car` search/list item from the
 * serializer (docs/DOMAIN.md "Wire contract"). NOTE: `plate` is PRIVATE
 * and never appears here; only agency endpoints return it.
 *
 * Relations arrive as embedded `NamedRef`s (`agency`/`make`/`model`), not
 * as ids + optional expansions. `primaryPhoto` is the first photo URL (or
 * `null`); the full gallery lives on `CarDetail.photos`.
 *
 * MONEY NAMING (contract-wide): every amount is `host*` or `renter*`.
 * `host*` is the agency's own figure and belongs on host and admin screens
 * ONLY; `renter*` is the same figure with the platform commission already
 * folded in, and is the only money a renter may be shown. There is no
 * commission line in a renter's breakdown — the markup lives inside the
 * rate. Both are server-computed: never derive one from the other here.
 */
export interface Car {
  location: {
    city: { id: string; name: string; slug: string };
    region: { id: string; name: string; slug: string; kind: string } | null;
    countryCode: string;
  };
  id: string;
  branchId: string;
  agency: CarAgencyRef;
  make: NamedRef;
  model: NamedRef;
  year: number;
  /** Enum wire value: white|black|gray|silver|blue|red|… */
  color: CarColor;
  transmission: Transmission;
  fuel: FuelType;
  seats: number;
  category: CarCategory;
  /** The host's own per-day rate, integer cents. HOST/ADMIN screens only. */
  hostDailyRateCents: number;
  /** The per-day rate a renter is shown, integer cents (commission included). */
  renterDailyRateCents: number;
  /** First photo URL, or null when the car has none. */
  primaryPhoto: string | null;
  /**
   * ORDERED gallery URLs. Uploaded photos arrive as API paths
   * (`/cars/photos/:photoId` — resolve via `resolveCarPhotoUrl`); legacy
   * absolute URLs pass through. Empty when the car has no photos.
   */
  photos: string[];
  status: CarStatus; // public search is always "active"
}

/**
 * Agency ref on a car DETAIL (wire `CarDetailAgencyDto`): the public slug ref
 * plus the rental conditions the customer accepts at request time.
 */
export interface CarDetailAgencyDto extends CarAgencyRef {
  rentalConditions: string | null;
  minDriverAge: number;
  depositNote: string | null;
}

/**
 * `CarDetail` = `Car` + the full gallery, branch (with city), and the
 * branch's active delivery zones. Returned by `GET /cars/:id`.
 */
export interface CarDetail extends Car {
  agency: CarDetailAgencyDto;
  branch: {
    id: string;
    name: string;
    city: CityRef;
    /** Exact street address + coordinates are PRIVATE — never on the car page.
     *  Delivery fee is computed server-side; the client only learns whether
     *  delivery is offered + the fee parameters (for display). */
    deliveryEnabled: boolean;
    renterDeliveryBaseFeeCents: number;
    renterDeliveryPerKmCents: number;
    deliveryMaxKm: number | null;
  };
  /** Active delivery zones of the car's branch (id/name/renter fee only). */
  deliveryZones: { id: string; name: string; renterFeeCents: number }[];
  /** Security deposit held at check-in (car -> agency -> platform), cents. */
  depositCents: number;
  /**
   * `depositCents > 0`, decided server-side. A deposit is a hold that is
   * returned — it is NEVER part of any total.
   */
  depositRequired: boolean;
}

/**
 * Agency-facing car shape (includes the private plate + the catalog ids
 * an edit form needs). Agency endpoints are RBAC-scoped and MAY expose
 * these extra fields; the public contract never does.
 */
export interface AgencyCar extends Car {
  plate?: string;
  makeId?: string;
  modelId?: string;
  /**
   * The RAW stored deposit of this car, integer cents — three distinct
   * states: `null` = inherit the agency's value, `0` = no deposit even if
   * the agency asks for one, `> 0` = this car's own figure.
   */
  depositOverrideCents: number | null;
  /** What the car -> agency -> platform chain yields today, integer cents. */
  resolvedDepositCents: number;
  /** `resolvedDepositCents > 0`; `false` means damage cannot be claimed. */
  depositRequired: boolean;
  /** The car's registration document, or null when none was uploaded yet. */
  registration: CarDocumentDto | null;
}

// ---------------------------------------------------- booking & availability

export const BOOKING_STATES = [
  "requested",
  "accepted",
  "active",
  "returned",
  "settled",
  "rejected",
  "expired",
  "cancelled",
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

/** Happy-path order used by the state timeline UI. */
export const BOOKING_HAPPY_PATH: readonly BookingState[] = [
  "requested",
  "accepted",
  "active",
  "returned",
  "settled",
];

/** Terminal branches off the happy path. */
export const BOOKING_TERMINAL_STATES: readonly BookingState[] = [
  "rejected",
  "expired",
  "cancelled",
];

export type PickupType = "branch_pickup" | "delivery";

/**
 * Booking pickup block (contract). `deliveryFeeCents` is always present
 * (0 for branch pickup); the zone id/name are present only for delivery.
 */
export interface BookingPickup {
  type: PickupType;
  /** Present only for delivery. */
  deliveryZoneId?: string;
  /** Snapshot of the zone name at request time; delivery only. */
  deliveryZoneName?: string;
  /** Door-to-door delivery: the customer's address + reference + distance. */
  deliveryAddress?: string;
  deliveryReference?: string;
  deliveryDistanceKm?: number;
  /** 0 for branch pickup. */
  deliveryFeeCents: number;
  /** Branch's exact address — present only once paid AND branch pickup. */
  branchAddress?: string;
  /** Same gate as `branchAddress` (paid + branch pickup). */
  branchPhone?: string;
  /** `{ mon: "08:00-18:00", … }` — same gate as `branchAddress`. */
  branchHours?: Record<string, string>;
}

/**
 * The renter's identity as the AGENCY (or an admin) sees it — emitted on a
 * booking only for viewer `agency`; the customer's own reads never carry it.
 */
export interface BookingCustomerDto {
  id: string;
  name: string;
  /**
   * Contact details are exposed to the agency viewer ONLY while the booking
   * is `accepted | active | returned` (ADR-0011 identity exposure); OMITTED
   * (undefined, never null) outside those states. The name is always present.
   */
  email?: string;
  phone?: string | null;
}

/**
 * Frozen pricing snapshot — computed SERVER-SIDE and never recomputed by
 * any client. All cents. Shared by `Booking.pricing` and the `Quote`
 * preview. `host*` / `renter*` follow the naming rule on {@link Car}.
 *
 * A RENTER breakdown is exactly three lines: `renterDailyRateCents` ×
 * `days` for `renterSubtotalCents`, `+ taxCents`, `= totalCents`. The
 * subtotal must be READ from `renterSubtotalCents` and never multiplied
 * out here: bookings taken before the markup moved inside the daily rate
 * carry a commission of `round(subtotal × pct)` and can differ from
 * `rate × days` by a cent or two.
 */
export interface Pricing {
  days: number;
  /** The host's own per-day rate. HOST/ADMIN only. */
  hostDailyRateCents: number;
  /** The per-day rate the renter is charged (commission included). */
  renterDailyRateCents: number;
  /** The host's own delivery fee. HOST/ADMIN only. */
  hostDeliveryFeeCents: number;
  /** The delivery fee the renter is charged (commission included). */
  renterDeliveryFeeCents: number;
  /** EXACTLY hostRate×days + hostDeliveryFee — what the agency is credited. */
  hostSubtotalCents: number;
  /** renterRate×days + renterDeliveryFee — what the renter's subtotal reads. */
  renterSubtotalCents: number;
  /** Snapshot % on a Booking; current % on a Quote. */
  commissionPct: number;
  /**
   * renterSubtotal − hostSubtotal, so the rounding remainder lands on the
   * platform and the host is credited to the cent. HOST/ADMIN only.
   */
  commissionCents: number;
  /** Server-computed tax amount and the rate used (the CAR's country). */
  taxCents: number;
  taxRatePct: number;
  /** renterSubtotal + tax (server total; never recompute). */
  totalCents: number;
  currency: string; // 'USD'
}

/** @deprecated Use `Pricing` — kept as an alias during the migration. */
export type PricingSnapshot = Pricing;

/** Server-computed price preview — NO booking is created. */
export interface Quote {
  pricing: Pricing;
  /** The deposit this booking would hold, resolved car -> agency -> platform. */
  depositCents: number;
  /** `depositCents > 0`. A hold that is returned — never part of the total. */
  depositRequired: boolean;
  expiresAt: string;
  token: string;
}

/**
 * Canonical `Booking` from the serializer (docs/DOMAIN.md). Everything is
 * nested: the car is a lightweight embed (make/model as strings), the
 * period is `{ start, end }`, and lifecycle instants live under
 * `timestamps` as ISO strings (absent ones are `null`).
 */
export interface Booking {
  id: string;
  car: {
    id: string;
    make: string;
    model: string;
    year: number;
    primaryPhoto: string | null;
  };
  branch: NamedRef;
  agency: NamedRef;
  period: Period;
  state: BookingState;
  pickup: BookingPickup;
  pricing: Pricing;
  timestamps: {
    requestedAt: string;
    acceptedAt: string | null;
    pickedUpAt: string | null;
    returnedAt: string | null;
    settledAt: string | null;
    updatedAt: string;
  };
  /**
   * Always emitted (null when unset). Machine reasons (`no_longer_available`,
   * `request_expired`, `payment_failed`, `payment_canceled`, `account_deleted`,
   * `period_started`) map to copy via `describeBookingReason`; anything else
   * is free text shown verbatim.
   */
  rejectionReason: string | null;
  cancellationReason: string | null;
  /** Renter identity — present ONLY for the agency/admin viewer. */
  customer?: BookingCustomerDto;
  /** Frozen booking deposit from the backend, cents; never use current car/config values. */
  depositCents: number;
  /** `depositCents > 0`; the hold is returned and is not part of the total. */
  depositRequired: boolean;
  /** Check-in / check-out inspections (ADR-0011), lightweight refs. */
  inspections: { type: InspectionType; status: InspectionStatus; id: string }[];
  /** The hand-over code step. Always present. */
  handover: BookingHandover;
}

/**
 * The six digits the renter gives the agency when the car changes hands.
 *
 * One shape for every viewer, with the secret blanked out for those who may
 * not see it — `code` is non-null ONLY in the renter's own payload. The
 * agency sees `codeRequired` and `confirmedAt` and nothing else, which is
 * what makes the code worth asking for.
 */
export interface BookingHandover {
  /** The digits — the renter only. Null for the agency, admin, and walk-ins. */
  code: string | null;
  /** Whether this booking needs the code before pick-up can be recorded. */
  codeRequired: boolean;
  /** ISO instant the agency entered the right code; null until then. */
  confirmedAt: string | null;
}

/** Renter block of the frozen rental agreement (license masked to last 4). */
export interface BookingAgreementRenter {
  fullName: string;
  /**
   * Same ADR-0011 gate as `BookingCustomerDto`: the licence is OMITTED
   * (undefined) for an agency viewer outside `accepted | active | returned`.
   * The full name is always present.
   */
  licenseMasked?: string;
  licenseExpiry?: string | null; // YYYY-MM-DD
}

/**
 * Snapshot of what the customer accepted at request time (wire
 * `BookingAgreementDto`, ADR-0007): terms version, renter identity, the
 * car's plate and the agency's rental conditions as they read that day.
 * Null when the booking predates the snapshot (or is a walk-in).
 */
export interface BookingAgreement {
  termsVersion: string;
  acceptedAt: string;
  renter: BookingAgreementRenter;
  car: { plate: string | null };
  agencyConditions: string | null;
  /** The signed rental-agreement document (ADR-0010); null for walk-ins. */
  document: BookingAgreementDocumentDto | null;
}

/**
 * Payment outcome of `POST /bookings` (wire `BookingPaymentDto`):
 *  - `authorized`      — the card hold is live; nothing else to do.
 *  - `requires_action` — the client MUST run the Stripe next-action (3DS)
 *                        with `clientSecret`; a webhook then promotes the
 *                        payment to authorized server-side (async).
 *  - `failed`          — no hold; the request can never be accepted and is
 *                        auto-rejected server-side.
 */
export type BookingPaymentStatus = "authorized" | "requires_action" | "failed";

export interface BookingPayment {
  status: BookingPaymentStatus;
  /** Stripe PaymentIntent client secret — non-null ONLY for requires_action. */
  clientSecret: string | null;
}

/** `POST /bookings` response: the booking + its real payment outcome. */
export interface BookingWithPayment extends Booking {
  payment: BookingPayment;
}

/**
 * Full payment lifecycle as `GET /bookings/:id` may report it (backend
 * `PaymentStatus` enum) — the detail read can surface any stage, not just
 * the three creation outcomes.
 */
export type PaymentLifecycleStatus =
  | BookingPaymentStatus
  | "captured"
  | "voided"
  | "refunded"
  | "capture_failed";

export interface BookingDetailPayment {
  status: PaymentLifecycleStatus;
  /** Non-null ONLY while `requires_action` — the resume-3DS credential. */
  clientSecret: string | null;
}

/**
 * `GET /bookings/:id` response (wire `BookingDetailDto`). `payment` is
 * present ONLY for the booking's OWNING CUSTOMER (never the agency side)
 * and only when a Payment row exists (walk-ins have none). While it is
 * `requires_action` it carries the client secret so the customer can RESUME
 * a pending 3DS challenge after a page reload.
 */
export interface BookingDetail extends Booking {
  payment?: BookingDetailPayment;
  /** Rental agreement snapshot — for both parties; null when none exists. */
  agreement: BookingAgreement | null;
  /** Security deposit hold (ADR-0013); null before check-in / for walk-ins. */
  deposit: DepositDto | null;
  /** Open or decided damage claim; parties + admin only. */
  claim: ClaimDto | null;
  /** Settlement outcome (ADR-0012); null until cancelled/settled. */
  settlement: SettlementDto | null;
  /** Refund preview — owning customer only, in `requested | accepted`. */
  cancellationQuote?: CancellationQuoteDto;
}

/** Availability response: the blocked windows in `[from, to)`. */
export interface Availability {
  carId: string;
  occupied: Period[];
}

/**
 * One occupied period of a car (booking or manual/offline block). Used by
 * the AGENCY calendar surface, which lists the source/note per row; the
 * public availability endpoint returns bare `Period[]` (see `Availability`).
 */
export interface OccupancyEntry {
  id: string;
  carId: string;
  startDate: string;
  endDate: string; // half-open [start, end)
  source: "booking" | "manual_block";
  bookingId?: string;
  note?: string;
}

// ----------------------------------------------- customer identity (KYC/ADR-0004)

/**
 * Customer identity verification status. `unverified` = never submitted; the
 * booking gate only lets `verified` customers rent. Distinct from
 * `AgencyVerificationStatus` (no "unverified" there — an application always exists).
 */
export type CustomerVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";

/** The four required identity photos (front/back of ID + driver's license). */
export const CUSTOMER_DOCUMENT_TYPES = [
  "id_front",
  "id_back",
  "license_front",
  "license_back",
] as const;
export type CustomerDocumentType = (typeof CUSTOMER_DOCUMENT_TYPES)[number];

export interface CustomerDocument {
  id: string;
  /** id_front | id_back | license_front | license_back */
  type: CustomerDocumentType;
  filename: string;
  contentType: string;
  uploadedAt: string;
}

/**
 * The customer's own verification view — drives the account page and the
 * booking gate. The license flags are server-computed against "today":
 *  - `licenseExpired`     → already past expiry (blocks + auto-rejects on submit)
 *  - `licenseExpiresSoon` → within the 30-day alert window (warn, still valid)
 *  - `daysUntilExpiry`    → negative when expired, null when no license on file
 */
export interface CustomerVerification {
  status: CustomerVerificationStatus;
  licenseNumber: string | null;
  licenseExpiry: string | null; // YYYY-MM-DD
  /** YYYY-MM-DD; null until submitted (age gate needs it). */
  dateOfBirth: string | null;
  rejectionReason: string | null;
  licenseExpired: boolean;
  licenseExpiresSoon: boolean;
  daysUntilExpiry: number | null;
}

/** `GET /verification/me` — the customer's status plus their uploaded photos. */
export interface CustomerVerificationWithDocuments {
  verification: CustomerVerification;
  documents: CustomerDocument[];
}

/** Admin review view of one customer's verification (never the file bytes). */
/**
 * One row of the admin KYC queue (`GET /verification/customers`). No licence
 * number and no date of birth: the queue triages, the detail reviews — and the
 * detail read is written to the server's identity access log, so it is fetched
 * one customer at a time, when a reviewer actually opens them.
 */
export interface CustomerVerificationQueueRow {
  userId: string;
  name: string;
  email: string;
  status: CustomerVerificationStatus;
  licenseExpired: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  documentCount: number;
  createdAt: string;
}

export interface CustomerVerificationAdmin {
  userId: string;
  name: string;
  email: string;
  status: CustomerVerificationStatus;
  licenseNumber: string | null;
  licenseExpiry: string | null;
  dateOfBirth: string | null;
  licenseExpired: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  documents: CustomerDocument[];
  documentCount: number;
  createdAt: string;
}

// ------------------------------------------------------------------- money

export type PaymentStatus = "authorized" | "captured" | "voided" | "refunded";

/**
 * Saved card — the serializer emits ONLY these display fields; gateway
 * customer/payment-method ids and tokens NEVER cross the wire (invariant
 * #3), and PANs never touch this app.
 */
export interface PaymentMethod {
  id: string;
  brand: string; // "visa" | "mastercard" | ...
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface WalletAccount {
  id: string;
  balanceCents: number;
  currency: string;
}

/**
 * Ledger movement kinds (backend `LedgerKind` + the cancellation-policy
 * kinds). Rendered with labels via `ledgerKindLabel`; unknown kinds fall
 * back to the raw string so a new backend kind never blanks a row.
 */
export type LedgerKind =
  | "settlement"
  | "payout"
  | "refund"
  | "late_cancellation_retention"
  | "early_return_refund"
  | "retention"
  | "claim"
  | "payout_reversal";

export interface LedgerEntry {
  id: string;
  accountId: string;
  bookingId?: string;
  amountCents: number; // signed: credit > 0, debit < 0
  description: string;
  kind: LedgerKind;
  /** Set on `payout` debits — the payout the money left with. */
  payoutId?: string;
  createdAt: string;
}

/**
 * `GET /agency/wallet/earnings` (wire `AgencyEarningsDto`).
 *
 * Three figures that are deliberately not one, because the difference is
 * what a host needs: what they can take now, what is coming and when, and
 * what is still being earned by rentals under way. Every number is integer
 * cents, decided by the server's ledger — this app only formats them.
 */
export interface AgencyEarnings {
  currency: string;
  /** Withdrawable now; leaves automatically on `nextPayoutAt`. */
  availableCents: number;
  /** Credited and visible, not yet theirs to take. */
  heldCents: number;
  /** Each held piece, so the UI can say why it waits and until when. */
  held: HeldEarning[];
  /** Earned by rentals under way; arrives when the booking settles. */
  pendingCents: number;
  /** ISO instant of the next automatic weekly payout. */
  nextPayoutAt: string;
  history: AgencyEarningsHistory;
}

export interface HeldEarning {
  bookingId: string | null;
  amountCents: number;
  /** ISO instant at which it becomes withdrawable. */
  availableAt: string;
}

export interface AgencyEarningsHistory {
  /** Bucket starts as `YYYY-MM-DD` in the business timezone, newest first. */
  day: EarningsBucket[];
  week: EarningsBucket[];
  month: EarningsBucket[];
}

export interface EarningsBucket {
  periodStart: string;
  earnedCents: number;
}

/** `GET /agency/wallet` (wire `AgencyWalletDto`). All cents, server-computed. */
/**
 * WHAT CANCELLING WOULD COST THE AGENCY — asked before it cancels.
 *
 * `GET /agency/requests/:id/cancellation-cover`. Quoted by the same
 * server-side function that later charges, which is the point: these
 * figures are not re-derived here, because a second copy of a money rule
 * drifts the first time either moves.
 *
 * Only `requested` and `accepted` bookings have a cover; anything else
 * answers 404.
 */
export interface AgencyCancellationCover {
  /**
   *   nothing_captured — the renter's card is only on hold; cancelling is free
   *   standard         — charged, and the pick-up is still far off
   *   late             — charged, and close enough that the trip is at risk
   */
  tier: "nothing_captured" | "standard" | "late";
  /** What the agency covers if it cancels right now. */
  coverCents: number;
  /** The slice that reimburses the fee the card processor keeps. */
  processingFeeCents: number;
  /** The slice that reaches the renter. */
  renterCreditCents: number;
  /** ISO instant the renter's card is charged; null once it has been. */
  chargeableFrom: string | null;
  /** ISO instant the cover rises to the late tier; null once it has. */
  lateFrom: string | null;
  /** What it will cost from `lateFrom`. */
  lateCoverCents: number;
  currency: string;
}

export interface AgencyWallet {
  account: WalletAccount;
  /** Sum of payouts still `requested` — money already spoken for. */
  pendingPayoutCents: number;
  /** balance − pending; the cap for a new payout request. */
  availableCents: number;
  entries: LedgerEntry[];
  /** Stripe payout recipient (ADR-0012); null when the rail is not configured. */
  payoutAccount: PayoutAccountDto | null;
}

/**
 * Payout lifecycle: manual bank transfers go `requested → paid | rejected`;
 * Stripe payouts go `processing → paid | failed` (ADR-0012).
 */
export const PAYOUT_STATUSES = [
  "requested",
  "processing",
  "paid",
  "rejected",
  "failed",
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_KINDS = ["withdrawal", "settlement", "advance"] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number];

export const PAYOUT_METHODS = ["bank_transfer", "stripe_connect"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/** Stripe-side outbound payment status, mirrored by webhook. */
export const PAYOUT_RAIL_STATUSES = [
  "pending_submit",
  "submitted",
  "posted",
  "failed",
  "returned",
  "canceled",
] as const;
export type PayoutRailStatus = (typeof PAYOUT_RAIL_STATUSES)[number];

/** One payout (wire `PayoutDto`). `note` carries the reject reason. */
export interface Payout {
  id: string;
  agencyId: string;
  amountCents: number;
  currency: string;
  status: PayoutStatus;
  /** Bank transfer reference, set by the admin when paid. */
  reference: string | null;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
  method: PayoutMethod;
  kind: PayoutKind;
  /** The booking a settlement/advance payout belongs to; null for withdrawals. */
  bookingId: string | null;
  /** Stripe payouts only. */
  railStatus: PayoutRailStatus | null;
  /** What Stripe posted to the host's bank (minor units + currency, e.g. DOP). */
  receivedAmount: { value: number; currency: string } | null;
  failureReason: string | null;
}

// ── Stripe payout rail (ADR-0012) ──────────────────────────────────────────

export const PAYOUT_ACCOUNT_STATUSES = [
  "not_started",
  "onboarding",
  "restricted",
  "active",
  "disabled",
] as const;
export type PayoutAccountStatus = (typeof PAYOUT_ACCOUNT_STATUSES)[number];

/** `GET /agency/payout-account` (wire `PayoutAccountDto`). */
export interface PayoutAccountDto {
  status: PayoutAccountStatus;
  rail: string;
  /** Stripe requirement keys still due (shown verbatim as a hint list). */
  requirementsDue: string[];
  payoutMethod: {
    bankName: string | null;
    last4: string | null;
    currency: string;
  } | null;
  /** False when the rail is disabled by platform config / driver. */
  onboardingAvailable: boolean;
  lastSyncedAt: string | null;
}

export interface PayoutAccountAdminDto extends PayoutAccountDto {
  agencyId: string;
  agencyName: string;
  stripeAccountId: string | null;
  disabledReason: string | null;
}

/** Account lifecycle (backend `UserStatus`). */
export type UserStatus = "active" | "suspended" | "deleted";

/*
 * The admin platform configuration (`GET`/`PATCH /admin/config`) is NOT
 * declared here. It is a zod contract in
 * `src/features/admin/platform-config-contract.ts`, alongside the
 * server-owned ranges the console form enforces — one source, so the shape
 * and the bounds cannot drift apart. `CancellationPolicyDto` further down
 * stays: it is the PUBLIC policy published through `GET /legal/current`.
 */

// ── Contracts & e-sign (ADR-0010) ──────────────────────────────────────────

/** Short-lived download link for a private file (PDFs, licences, media). */
export interface SignedUrlDto {
  url: string;
  expiresAt: string;
}

/** Backend `ContractKind` (spec §0.1). */
export const CONTRACT_KINDS = ["host_agreement", "rental_agreement"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** Backend `ContractTemplateStatus`: one `published` row per kind. */
export const CONTRACT_TEMPLATE_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type ContractTemplateStatus = (typeof CONTRACT_TEMPLATE_STATUSES)[number];

/** `GET /legal/contracts/:kind` / the `current` block of the host agreement. */
export interface ContractTemplatePublicDto {
  kind: ContractKind;
  version: number;
  title: string;
  /** Server-rendered, sanitized HTML (Markdown → HTML, variables substituted). */
  html: string;
}

export interface ContractTemplateAdminDto {
  id: string;
  kind: ContractKind;
  version: number | null;
  title: string;
  bodyMarkdown: string;
  status: ContractTemplateStatus;
  changeNote: string | null;
  requireResign: boolean;
  createdAt: string;
  publishedAt: string | null;
}

export interface ContractSignatureDto {
  role: string;
  method: string;
  typedName: string;
  signedAt: string;
}

/** An immutable signed snapshot (HTML + PDF) with its signatures. */
export interface ContractDocumentDto {
  id: string;
  kind: ContractKind;
  templateVersion: number;
  status: string;
  createdAt: string;
  signatures: ContractSignatureDto[];
}

export interface ContractDocumentAdminDto extends ContractDocumentDto {
  subjectType: string;
  subjectId: string;
  htmlSha256: string;
  pdfSha256: string;
}

/** `GET /agency/host-agreement` (wire `HostAgreementStatusDto`). */
export interface HostAgreementStatusDto {
  /** The published version rendered with this host's variables. */
  current: ContractTemplatePublicDto;
  /** The host's signed document, or null before the first signature. */
  signed: ContractDocumentDto | null;
  /** A newer version was published with `requireResign` — nag, never block. */
  resignRequired: boolean;
}

/** Rental-agreement document ref on a booking. */
export interface BookingAgreementDocumentDto {
  id: string;
  templateVersion: number;
  status: string;
  signedAt: string;
  countersignedAt: string | null;
}

// ── Inspections & media (ADR-0011) ─────────────────────────────────────────

export interface InspectionMediaDto {
  id: string;
  kind: MediaKind;
  label: MediaLabel;
  status: string;
  /** Signed URL (parties + admin only); null until uploaded. */
  url: string | null;
  expiresAt: string | null;
  durationSeconds: number | null;
  position: number;
}

export interface InspectionMediaUploadDto {
  media: InspectionMediaDto;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresAt: string;
  };
}

export interface InspectionDto {
  id: string;
  bookingId: string;
  type: InspectionType;
  status: InspectionStatus;
  odometerKm: number | null;
  fuelLevelEighths: number | null;
  damageNotes: string | null;
  damageFlagged: boolean;
  media: InspectionMediaDto[];
  submittedAt: string | null;
  customerConfirmedAt: string | null;
  customerAbsentReason: string | null;
  customerDisputeNote: string | null;
  finalizedAt: string | null;
}

/** `GET /bookings/:bookingId/renter-license` (agency viewer, accepted..returned). */
export interface RenterLicenseDto {
  fullName: string;
  licenseNumber: string;
  licenseExpiry: string | null;
  documents: { type: string; url: string; expiresAt: string }[];
}

// ── Deposits, claims & settlement (ADR-0012 / ADR-0013) ────────────────────

// Enum literals (spec §0.1) — wire values the customer/host screens branch
// on. Kept as `as const` arrays so copy maps stay exhaustive; DTO fields
// stay plain strings (forward-compatible with new backend values).
export const INSPECTION_TYPES = ["checkin", "checkout"] as const;
export type InspectionType = (typeof INSPECTION_TYPES)[number];

export const INSPECTION_STATUSES = [
  "draft",
  "submitted",
  "confirmed",
  "confirmed_absent",
  "disputed",
  "void",
] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const MEDIA_KINDS = ["photo", "video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_LABELS = [
  "front",
  "rear",
  "left",
  "right",
  "interior",
  "odometer",
  "fuel",
  "damage",
  "other",
] as const;
export type MediaLabel = (typeof MEDIA_LABELS)[number];

export const DEPOSIT_STATUSES = [
  "pending_hold",
  "requires_action",
  "held",
  "reauthorizing",
  "released",
  "captured",
  "lapsed",
  "failed",
  "waived",
] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

export const CLAIM_STATUSES = [
  "open",
  "under_review",
  "approved",
  "approved_uncollectible",
  "rejected",
  "withdrawn",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const SETTLEMENT_CASES = [
  "completed",
  "early_return",
  "cancelled_free",
  "cancelled_late",
  "cancelled_by_host",
  "cancelled_mid_rental",
  "cancelled_requested",
] as const;
export type SettlementCase = (typeof SETTLEMENT_CASES)[number];

export interface DepositDto {
  amountCents: number;
  currency: string;
  status: DepositStatus;
  captureBefore: string | null;
  capturedCents: number;
  /** Owning customer only, while `requires_action` (resume 3DS). */
  clientSecret?: string | null;
}

export interface ClaimDto {
  id: string;
  bookingId: string;
  currency: string;
  status: ClaimStatus;
  requestedCents: number;
  approvedCents: number | null;
  capturedCents: number;
  uncollectedCents: number;
  description: string;
  evidenceMediaIds: string[];
  customerResponse: string | null;
  customerNote: string | null;
  respondBy: string;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

export interface ClaimAdminDto extends ClaimDto {
  agencyName: string;
  customerName: string;
  deposit: DepositDto | null;
  inspections: InspectionDto[];
}

export interface SettlementLineDto {
  code: string;
  label: string;
  amountCents: number;
}

/** Server-computed settlement outcome — rendered verbatim, never derived. */
export interface SettlementDto {
  status: string;
  case: SettlementCase;
  refundCents: number;
  retentionCents: number;
  earlyReturnRefundCents: number;
  unusedDays: number;
  claimCents: number;
  advanceCents: number;
  hostNetCents: number;
  platformNetCents: number;
  /** Tax allocated to the tax authority, outside both net amounts. */
  taxCents: number;
  breakdown: SettlementLineDto[];
  disputeWindowEndsAt: string | null;
  finalizedAt: string | null;
}

// ----------------------------------------------------------- communication

export interface MessageThread {
  id: string;
  bookingId: string;
}

export interface Message {
  id: string;
  threadId: string;
  /** 'customer' or 'agency'. The raw sender user id is NOT exposed by the API. */
  senderRole: "customer" | "agency";
  body: string;
  createdAt: string;
}

/**
 * `GET /messages/bookings/:bookingId` response — the thread ref plus the
 * ordered messages. The backend serializer nests messages under `messages`;
 * clients read `.messages`, never the top-level object as an array.
 */
export interface MessageThreadWithMessages {
  thread: MessageThread;
  messages: Message[];
}

// ------------------------------------------------------------------- legal

/**
 * Tiered cancellation policy — the NUMBERS come from the backend; no client
 * ever hardcodes them in copy.
 *  - free cancellation until `freeCancellationHours` before pickup;
 *  - later, `lateCancellationRetentionPct` of the subtotal is retained
 *    (goes to the agency) and the rest refunded;
 *  - early return refunds unused full days minus `earlyReturnPenaltyDays`.
 */
export interface CancellationPolicyDto {
  freeCancellationHours: number;
  lateCancellationRetentionPct: number;
  earlyReturnPenaltyDays: number;
}

/** `GET /legal/current` (wire `LegalCurrentDto`). */
export interface LegalCurrentDto {
  termsVersion: string;
  termsUrl: string;
  privacyUrl: string;
  cancellationPolicy: CancellationPolicyDto;
}

/**
 * `GET /bookings/:id/cancellation-quote` — the server's refund preview for
 * cancelling NOW. Rendered verbatim in the confirmation dialog; the client
 * never derives these amounts from the policy percentages itself.
 */
export interface CancellationQuoteDto {
  refundCents: number;
  retainedCents: number;
  currency: string;
  /** True when the free-cancellation window has already closed. */
  isLate: boolean;
  /** Always emitted by the backend cancellation quote; no embedded policy. */
  tier: "free" | "late" | "closed";
  freeUntil: string | null;
}

// -------------------------------------------------------------------- misc

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
