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
  status?: string;
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
  roles: string[];
  agencyId: string | null;
  isGuest: boolean;
  status: string;
  termsVersion: string | null;
  createdAt: string;
}

// --------------------------------------------------------------------- geo

export interface Country {
  id: string;
  name: string;
  code: string; // ISO-3166 alpha-2, e.g. "DO"
}

export interface City {
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
 * Agency ref embedded in a `Car` — `NamedRef` plus the URL `slug`, so the
 * client builds the canonical `/agencies/:slug/cars/:id` detail link
 * (store-scoped product URL, Beusun-style) without re-deriving it from the name.
 */
export interface CarAgencyRef {
  id: string;
  name: string;
  slug: string;
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

/**
 * Public car shape — the canonical `Car` search/list item from the
 * serializer (docs/DOMAIN.md "Wire contract"). NOTE: `plate` is PRIVATE
 * and never appears here; only agency endpoints return it.
 *
 * Relations arrive as embedded `NamedRef`s (`agency`/`make`/`model`), not
 * as ids + optional expansions. `primaryPhoto` is the first photo URL (or
 * `null`); the full gallery lives on `CarDetail.photos`.
 */
export interface Car {
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
  /** Per-day rate, integer cents — set by the agency, displayed as-is. */
  pricePerDayCents: number;
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
    deliveryBaseFeeCents: number;
    deliveryPerKmCents: number;
    deliveryMaxKm: number | null;
  };
  /** Active delivery zones of the car's branch (id/name/fee only). */
  deliveryZones: { id: string; name: string; feeCents: number }[];
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
  email: string;
  phone: string | null;
}

/**
 * Frozen pricing snapshot — computed SERVER-SIDE (days x rate + delivery
 * fee + platform commission) and never recomputed by any client. All
 * cents. Shared by `Booking.pricing` and the `Quote` preview.
 */
export interface Pricing {
  days: number;
  ratePerDayCents: number;
  deliveryFeeCents: number;
  /** days×rate + deliveryFee (what the agency earns). */
  subtotalCents: number;
  /** Snapshot % on a Booking; current % on a Quote. */
  commissionPct: number;
  /** round(subtotal × pct / 100), half-up. */
  commissionCents: number;
  /** subtotal + commission (what the customer pays). */
  totalCents: number;
  currency: string; // 'USD'
}

/** @deprecated Use `Pricing` — kept as an alias during the migration. */
export type PricingSnapshot = Pricing;

/** Server-computed price preview — NO booking is created. */
export interface Quote {
  pricing: Pricing;
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
}

/** Renter block of the frozen rental agreement (license masked to last 4). */
export interface BookingAgreementRenter {
  fullName: string;
  licenseMasked: string;
  licenseExpiry: string | null; // YYYY-MM-DD
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
  type: string;
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
  | "early_return_refund";

export interface LedgerEntry {
  id: string;
  accountId: string;
  bookingId?: string;
  amountCents: number; // signed: credit > 0, debit < 0
  description: string;
  /** `LedgerKind` on the wire as a plain string (forward-compatible). */
  kind: string;
  /** Set on `payout` debits — the payout the money left with. */
  payoutId?: string;
  createdAt: string;
}

/** `GET /agency/wallet` (wire `AgencyWalletDto`). All cents, server-computed. */
export interface AgencyWallet {
  account: WalletAccount;
  /** Sum of payouts still `requested` — money already spoken for. */
  pendingPayoutCents: number;
  /** balance − pending; the cap for a new payout request. */
  availableCents: number;
  entries: LedgerEntry[];
}

export const PAYOUT_STATUSES = ["requested", "paid", "rejected"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/** One payout request (wire `PayoutDto`). `note` carries the reject reason. */
export interface Payout {
  id: string;
  agencyId: string;
  amountCents: number;
  currency: string;
  /** `PayoutStatus` on the wire as a plain string. */
  status: string;
  /** Bank transfer reference, set by the admin when paid. */
  reference: string | null;
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

/** Account lifecycle (backend `UserStatus`). */
export type UserStatus = "active" | "suspended" | "deleted";

export interface PlatformConfig {
  /** Commission % snapshotted into each booking at request time. */
  commissionPct: number;
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
}

// -------------------------------------------------------------------- misc

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
