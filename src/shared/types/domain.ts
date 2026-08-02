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

export type AgencyVerificationStatus = "pending" | "verified" | "rejected";

export interface Agency {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  verificationStatus: AgencyVerificationStatus;
  createdAt: string;
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
  status: CarStatus; // public search is always "active"
}

/**
 * `CarDetail` = `Car` + the full gallery, branch (with city), and the
 * branch's active delivery zones. Returned by `GET /cars/:id`.
 */
export interface CarDetail extends Car {
  photos: string[];
  branch: {
    id: string;
    name: string;
    city: CityRef;
    /** Exact street address is PRIVATE — revealed on the booking after payment. */
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
  /** 0 for branch pickup. */
  deliveryFeeCents: number;
  /** Branch's exact address — present only once paid AND branch pickup. */
  branchAddress?: string;
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
  /** Reason for rejected/cancelled states (e.g. "no_longer_available"). */
  stateReason?: string;
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

export interface LedgerEntry {
  id: string;
  accountId: string;
  bookingId?: string;
  amountCents: number; // signed: credit > 0, debit < 0
  description: string;
  createdAt: string;
}

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
  senderId: string;
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

// -------------------------------------------------------------------- misc

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
