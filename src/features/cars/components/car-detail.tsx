"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  Palette,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CarsApi, carKeys } from "@/features/cars/api";
import {
  BookingsApi,
  type QuoteInput,
  type SignatureInput,
} from "@/features/bookings/api";
import {
  RentalAgreementSignDialog,
  type SignStepError,
} from "@/features/bookings/components/rental-agreement-sign-dialog";
import { useRequestPayment } from "@/features/bookings/use-request-payment";
import { useLegalCurrent } from "@/features/legal/hooks";
import { CancellationPolicySummary } from "@/features/legal/components/cancellation-policy";
import { PrivateHostBadge } from "@/features/agencies/components/private-host-badge";
import { TermsCheckbox } from "@/features/auth/components/terms-checkbox";
import {
  PaymentMethodsApi,
  paymentMethodKeys,
} from "@/features/payments/api";
import { VerificationApi, verificationKeys } from "@/features/verification/api";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import {
  DateRangePicker,
  addDaysIso,
  blockedDayPredicate,
} from "@/shared/components/date-range-picker";
import { canOptimizeCarPhoto, carGallery } from "@/features/cars/photos";
import { CarPhotoPlaceholder } from "@/features/cars/components/car-photo-placeholder";
import { RentalPolicyCard } from "@/features/cars/components/rental-policy-card";
import { useAuthStore } from "@/shared/auth/store";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import type {
  CarDetail as CarDetailShape,
  CarDetailAgencyDto,
  PaymentMethod,
  Period,
  PickupType,
} from "@/shared/types/domain";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import { formatIsoDate, isoDateParts, todayIso } from "@/shared/utils/dates";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { cn } from "@/lib/utils";

/** How far ahead the availability window (and the picker) reaches. */
const AVAILABILITY_DAYS = 90;

export function CarDetail({
  carId,
  initialFrom,
  initialTo,
}: {
  carId: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const carQuery = useQuery({
    queryKey: carKeys.detail(carId),
    queryFn: () => CarsApi.findById(carId),
  });

  // ONE availability fetch feeds both the blocked-days list and the date
  // picker (same key → TanStack dedupes; the server owns availability).
  const availabilityFrom = todayIso();
  const availabilityTo = addDaysIso(availabilityFrom, AVAILABILITY_DAYS);
  const availabilityQuery = useQuery({
    queryKey: carKeys.availability(carId, availabilityFrom, availabilityTo),
    queryFn: () => CarsApi.availability(carId, availabilityFrom, availabilityTo),
  });
  const occupied = useMemo(
    () => availabilityQuery.data?.occupied ?? [],
    [availabilityQuery.data],
  );

  if (carQuery.isPending) return <LoadingState label="Loading car…" />;
  if (carQuery.isError) {
    return (
      <ErrorState
        title="Could not load this car"
        message={carQuery.error.message}
        onRetry={() => carQuery.refetch()}
      />
    );
  }

  const car = carQuery.data;
  const gallery = carGallery(car);
  const specs = [
    { icon: Gauge, label: "Transmission", value: car.transmission },
    { icon: Fuel, label: "Fuel", value: car.fuel },
    { icon: Users, label: "Seats", value: String(car.seats) },
    { icon: Palette, label: "Color", value: car.color },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <PhotoGallery
          photos={gallery}
          alt={`${car.make.name} ${car.model.name}`}
        />

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-foreground md:text-4xl">
            {car.make.name} {car.model.name} {car.year}
          </h1>
          <Badge variant="accent" className="capitalize">
            {car.category}
          </Badge>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>
            Offered by{" "}
            <Link
              href={`/agencies/${car.agency.slug}`}
              className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              {car.agency.name}
            </Link>
          </span>
          <PrivateHostBadge kind={car.agency.kind} />
        </p>

        {/* Elegant spec grid. */}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {specs.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.label}
                className="rounded-[var(--radius-sm)] border border-border bg-surface p-4 shadow-sm"
              >
                <Icon className="h-5 w-5 text-primary" />
                <dt className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-0.5 font-semibold capitalize text-foreground">
                  {s.value}
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="mt-6 flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
          <span>
            <span className="font-medium text-foreground">
              {car.branch.name}
            </span>{" "}
            — {car.branch.city.name}
            <br />
            <span className="text-xs">
              The exact pickup address is shared once your booking is confirmed.
            </span>
          </span>
        </div>

        <AvailabilityCalendar
          occupied={occupied}
          isLoading={availabilityQuery.isLoading}
          isError={availabilityQuery.isError}
          onRetry={() => availabilityQuery.refetch()}
        />

        <RentalPolicyCard
          className="mt-6"
          depositCents={car.depositCents}
          agencyName={car.agency.name}
        />
      </div>

      <div className="space-y-4">
        <RentalConditions agency={car.agency} depositCents={car.depositCents} />
        <BookingPanel
          car={car}
          initialFrom={initialFrom}
          initialTo={initialTo}
          occupied={occupied}
          availabilityWindow={{ start: availabilityFrom, end: availabilityTo }}
        />
      </div>
    </div>
  );
}

/**
 * Photo gallery from `carGallery(car)` — the car's REAL uploaded photos.
 * Large hero lead image + a thumbnail strip. When the agency hasn't uploaded
 * any, a branded neutral placeholder fills the hero slot (never stock — we
 * never show someone else's car).
 */
function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const lead = photos[active] ?? photos[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-lg)] bg-muted shadow-sm">
        {lead ? (
          <Image
            src={lead}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover"
            priority
            unoptimized={!canOptimizeCarPhoto(lead)}
          />
        ) : (
          <CarPhotoPlaceholder label="Photos coming soon" />
        )}
      </div>
      {photos.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {photos.slice(0, 8).map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-[var(--radius-sm)] bg-muted transition-all",
                active === i
                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "opacity-80 hover:opacity-100",
              )}
            >
              <Image
                src={src}
                alt={`${alt} photo ${i + 1}`}
                fill
                sizes="20vw"
                className="object-cover"
                unoptimized={!canOptimizeCarPhoto(src)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Rental conditions by {agency}" — the agency's own terms the customer
 * accepts at request time (frozen into the booking's agreement snapshot):
 * free-text conditions, minimum driver age, the security deposit (server
 * figure: car override or platform default) and the deposit note. Rendered
 * ABOVE the booking widget so nobody requests without seeing them.
 */
function RentalConditions({
  agency,
  depositCents,
}: {
  agency: CarDetailAgencyDto;
  depositCents: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const conditions = agency.rentalConditions?.trim() ?? "";
  const long = conditions.length > 420;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Rental conditions by {agency.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Minimum driver age
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {agency.minDriverAge} years
            </dd>
          </div>
          <div className="rounded-[var(--radius-sm)] bg-muted/60 p-3">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Security deposit
            </dt>
            <dd className="mt-0.5 font-semibold text-foreground">
              {depositCents > 0 ? formatMoneyCents(depositCents) : "None"}
            </dd>
          </div>
        </dl>

        {agency.depositNote ? (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Deposit: </span>
            {agency.depositNote}
          </p>
        ) : null}

        {conditions ? (
          <div>
            <p
              className={cn(
                "whitespace-pre-line leading-relaxed text-muted-foreground",
                long && !expanded && "line-clamp-6",
              )}
            >
              {conditions}
            </p>
            {long ? (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <>
                    Show less <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Read all conditions <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            This agency has not published additional conditions. The platform
            Terms of Service and the cancellation policy still apply.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          These conditions are saved with your booking exactly as they read
          today.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Availability list for the next ~90 days: renders the server's blocked
 * windows (`Availability.occupied`, `Period[]`). The server owns
 * availability; this UI only reflects it — the booking panel's server
 * quote has the final word on any conflict.
 */
function AvailabilityCalendar({
  occupied,
  isLoading,
  isError,
  onRetry,
}: {
  occupied: Period[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Availability (next {AVAILABILITY_DAYS} days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingState label="Loading availability…" className="py-6" />
        ) : isError ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Availability could not be loaded. You can still request dates —
              the server always has the final word on conflicts.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : occupied.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No blocked dates in this window.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {occupied.map((p) => (
              <li key={`${p.start}-${p.end}`} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {formatIsoDate(p.start)} → {formatIsoDate(p.end)} (unavailable)
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Occupied ranges are half-open: the car is free again on the end
          date.
        </p>
      </CardContent>
    </Card>
  );
}

/** Whole years between a YYYY-MM-DD birth date and a YYYY-MM-DD reference day. */
function ageOn(dateOfBirth: string, day: string): number {
  const birth = isoDateParts(dateOfBirth);
  const on = isoDateParts(day);
  let age = on.year - birth.year;
  if (on.month < birth.month || (on.month === birth.month && on.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/**
 * Map the request-to-book gate errors (stable backend `code`s) to copy the
 * customer can act on. Anything unmapped falls back to the server message.
 */
function describeRequestError(error: unknown): {
  message: string;
  action?: { label: string; href: string };
} {
  const code = getApiErrorCode(error);
  switch (code) {
    case API_ERROR_CODES.TERMS_OUTDATED:
      return {
        message:
          "Our terms were updated while you were on this page. Please review and accept the current version, then request again.",
      };
    case API_ERROR_CODES.TERMS_ACCEPTANCE_REQUIRED:
      return {
        message: "You need to accept the Terms of Service to request a booking.",
      };
    case API_ERROR_CODES.CUSTOMER_NOT_VERIFIED:
      return {
        message:
          "Your identity is not verified yet. Complete the one-time verification to book.",
        action: { label: "Verify identity", href: "/account/verification" },
      };
    case API_ERROR_CODES.VERIFICATION_INCOMPLETE:
      return {
        message:
          "Your verification is missing your date of birth, which agencies need to check their minimum driver age.",
        action: { label: "Add date of birth", href: "/account/verification" },
      };
    case API_ERROR_CODES.DRIVER_TOO_YOUNG:
      return {
        message:
          "You do not meet this agency's minimum driver age on the pickup date, so this car cannot be requested.",
      };
    case API_ERROR_CODES.LICENSE_EXPIRES_BEFORE_END:
      return {
        message:
          "Your driver's license expires before this rental ends. Renew it or choose an earlier return date.",
        action: { label: "Update license", href: "/account/verification" },
      };
    case API_ERROR_CODES.RENTAL_TOO_LONG:
      return {
        message:
          "This rental is longer than the maximum allowed. Choose a shorter period.",
      };
    case API_ERROR_CODES.SIGNATURE_REQUIRED:
      return {
        message:
          "Type your full name and tick the box to sign the rental agreement before sending the request.",
      };
    case API_ERROR_CODES.TEMPLATE_NOT_PUBLISHED:
      return {
        message:
          "The rental agreement is not available right now, so new requests are paused. Please try again later.",
      };
    default:
      return {
        message: getErrorMessage(
          error,
          "The request could not be sent. Please try again.",
        ),
      };
  }
}

/**
 * Booking panel: date range (blocked days disabled) + pickup choice
 * (branch | delivery-with-zone | delivery-to-address) + SERVER-computed
 * quote (POST /bookings/quote) + saved-card choice (the selected id travels
 * as `paymentMethodId`; the hold is placed on exactly that card, defaulting
 * to the backend's default = most recently saved) + terms acceptance
 * (`acceptTerms` + `termsVersion` from `GET /legal/current`) + the
 * "Review and sign the rental agreement" step (ADR-0010): the request is
 * only sent from the sign dialog, with the click-to-sign `signature`.
 * The client never multiplies days x rate — it renders the returned Pricing
 * verbatim.
 *
 * Delivery zones come embedded in `CarDetail` — no extra request.
 */
function BookingPanel({
  car,
  initialFrom,
  initialTo,
  occupied,
  availabilityWindow,
}: {
  car: CarDetailShape;
  initialFrom?: string;
  initialTo?: string;
  occupied: Period[];
  availabilityWindow: Period;
}) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const legal = useLegalCurrent();

  // A card is required to book (the request places a hold on it). Gate the
  // request button on the customer having a saved payment method.
  const cardsQuery = useQuery({
    queryKey: paymentMethodKeys.mine(),
    queryFn: PaymentMethodsApi.findMine,
    enabled: status === "authenticated",
  });
  const cards = cardsQuery.data ?? [];
  const hasCard = cards.length > 0;

  // Which saved card the hold goes on. The list arrives newest-first, and the
  // backend's no-id fallback is the most recently saved card — so defaulting
  // to `cards[0]` shows exactly what the server would charge. The chosen id
  // travels as `paymentMethodId` (server-validated: 404 foreign, 400 expired).
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const selectedCard =
    cards.find((c) => c.id === selectedCardId) ?? cards[0] ?? null;

  // Identity gate: only a VERIFIED customer with a valid license can rent.
  // The server enforces it (assertCanRent); we read `/verification/me` to show
  // the right CTA up front instead of letting the request 403.
  const verifQuery = useQuery({
    queryKey: verificationKeys.me(),
    queryFn: VerificationApi.me,
    enabled: status === "authenticated",
  });
  const verification = verifQuery.data?.verification;
  const isVerified = verification?.status === "verified";

  const [range, setRange] = useState({
    from: initialFrom ?? "",
    to: initialTo ?? "",
  });
  const from = range.from;
  const to = range.to;
  const [calendarOpen, setCalendarOpen] = useState(!initialFrom || !initialTo);
  const [pickup, setPickup] = useState<PickupType>("branch_pickup");
  const [zoneId, setZoneId] = useState<string>("");
  const [deliveryAddr, setDeliveryAddr] = useState<PickedAddress | null>(null);
  const [deliveryReference, setDeliveryReference] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const isDayBlocked = useMemo(() => blockedDayPredicate(occupied), [occupied]);

  // Dates pre-filled from the URL may collide with a block the customer has
  // not seen yet — flag it (the server would reject the request anyway).
  const rangeBlocked = useMemo(() => {
    if (!from || !to || to <= from) return false;
    for (let d = from; d < to; d = addDaysIso(d, 1)) {
      if (isDayBlocked(d)) return true;
    }
    return false;
  }, [from, to, isDayBlocked]);

  const zones = car.deliveryZones;
  // Address-based delivery when the branch enables it; else legacy zones (if any).
  const addressDelivery = car.branch.deliveryEnabled;
  const deliveryAvailable = addressDelivery || zones.length > 0;

  const deliveryReady = addressDelivery ? !!deliveryAddr : !!zoneId;
  const datesReady = !!from && !!to && to > from;
  const quoteReady =
    datesReady && !rangeBlocked && (pickup === "branch_pickup" || deliveryReady);

  // Delivery params for the server (a geocoded address takes precedence).
  const deliveryParams =
    pickup === "delivery"
      ? addressDelivery && deliveryAddr
        ? {
            deliveryAddress: deliveryAddr.formattedAddress,
            deliveryLat: deliveryAddr.lat,
            deliveryLng: deliveryAddr.lng,
            deliveryReference: deliveryReference.trim() || undefined,
          }
        : { deliveryZoneId: zoneId }
      : {};

  // ONE body for the quote, the agreement preview and the request itself,
  // so the text the customer signs is rendered from exactly what is sent.
  const quoteInput: QuoteInput = {
    carId: car.id,
    start: from,
    end: to,
    pickupType: pickup,
    ...deliveryParams,
  };

  const quoteQuery = useQuery({
    queryKey: carKeys.quote(
      car.id,
      from,
      to,
      pickup,
      addressDelivery
        ? `${deliveryAddr?.lat ?? ""},${deliveryAddr?.lng ?? ""}`
        : zoneId || undefined,
    ),
    queryFn: () => BookingsApi.quote(quoteInput),
    enabled: quoteReady,
  });

  // The sign step: opened once the panel's own gates pass; the request is
  // sent from inside it with the signature.
  const [signOpen, setSignOpen] = useState(false);

  // Payment outcome state machine: `authorized` → redirect; `requires_action`
  // → Stripe 3DS challenge + "Verifying…" poll; `failed` → honest error.
  const payment = useRequestPayment({
    onAuthorized: (bookingId) => router.push(`/account/bookings/${bookingId}`),
  });

  const requestMutation = useMutation({
    mutationFn: ({
      signature,
      // The version the customer just accepted — read from the server.
      termsVersion,
    }: {
      signature: SignatureInput;
      termsVersion: string;
    }) =>
      BookingsApi.request({
        ...quoteInput,
        // Always send the card the customer sees selected — even the default —
        // so what's displayed is exactly what gets the hold.
        paymentMethodId: selectedCard?.id,
        termsVersion,
        // The click-to-sign collected in the agreement step.
        signature,
      }),
    onSuccess: (booking) => {
      setSignOpen(false);
      payment.start(booking);
    },
    onError: async (error) => {
      if (getApiErrorCode(error) === API_ERROR_CODES.TERMS_OUTDATED) {
        // Ask for a fresh consent against the new version (the agreement
        // must be re-read too, so the sign step closes).
        setSignOpen(false);
        setAcceptTerms(false);
        await legal.refetch();
      }
    },
  });

  const paymentBusy =
    payment.phase.step === "challenge" || payment.phase.step === "verifying";

  const quote = quoteQuery.data;

  // A verified customer whose license expires before the chosen return date is
  // blocked server-side (assertCanRent). Warn + disable proactively.
  // Carries the expiry date itself so the warning can render it without
  // re-deriving (and without asserting) that it is present.
  const licenseExpiryBeforeReturn: string | null =
    isVerified && verification?.licenseExpiry && to && verification.licenseExpiry < to
      ? verification.licenseExpiry
      : null;

  // Agency minimum driver age, checked on the pickup day (server does the
  // same in the business timezone). No date of birth on file → the server
  // answers VERIFICATION_INCOMPLETE, so point there first.
  const dobMissing = isVerified && verification?.dateOfBirth === null;
  const tooYoung =
    isVerified &&
    !!verification?.dateOfBirth &&
    !!from &&
    ageOn(verification.dateOfBirth, from) < car.agency.minDriverAge;

  const legalReady = legal.isSuccess && !!legal.data;
  const requestError: SignStepError | null = requestMutation.isError
    ? describeRequestError(requestMutation.error)
    : null;

  function openSignStep() {
    if (!acceptTerms) {
      setTermsError("Accept the Terms of Service to continue.");
      return;
    }
    setTermsError(null);
    payment.reset(); // clear a previous failed attempt, if any
    requestMutation.reset();
    setSignOpen(true);
  }

  return (
    <Card className="h-fit lg:sticky lg:top-24">
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold">
            {formatMoneyCents(car.pricePerDayCents)}
          </span>
          <span className="text-sm font-normal text-muted-foreground">
            / day
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {/* Dates: two summary fields that open the blocked-days picker. */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp-from">Pickup</Label>
            <button
              id="bp-from"
              type="button"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((v) => !v)}
              className={cn(
                "flex h-10 w-full items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 text-left text-sm shadow-sm transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                !from && "text-muted-foreground",
              )}
            >
              {from ? formatIsoDate(from) : "Add date"}
            </button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-to">Return</Label>
            <button
              id="bp-to"
              type="button"
              aria-expanded={calendarOpen}
              onClick={() => setCalendarOpen((v) => !v)}
              className={cn(
                "flex h-10 w-full items-center rounded-[var(--radius-sm)] border border-border bg-surface px-3.5 text-left text-sm shadow-sm transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                !to && "text-muted-foreground",
              )}
            >
              {to ? formatIsoDate(to) : "Add date"}
            </button>
          </div>
        </div>

        {calendarOpen ? (
          <DateRangePicker
            value={range}
            onChange={(next) => {
              setRange(next);
              if (next.from && next.to) setCalendarOpen(false);
            }}
            minDate={availabilityWindow.start}
            maxDate={availabilityWindow.end}
            isDayBlocked={isDayBlocked}
          />
        ) : null}

        {rangeBlocked ? (
          <p
            className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            role="alert"
          >
            The car is unavailable on some of these days. Pick different dates
            — blocked days are marked in the calendar.
          </p>
        ) : null}

        {/* Pickup choice: branch pickup or delivery to a zone */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Pickup option</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pickup"
              checked={pickup === "branch_pickup"}
              onChange={() => setPickup("branch_pickup")}
            />
            Pick up at the branch (free)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="pickup"
              checked={pickup === "delivery"}
              disabled={!deliveryAvailable}
              onChange={() => setPickup("delivery")}
            />
            {addressDelivery
              ? "Deliver to my address (extra fee)"
              : "Delivery (airport / hotel zone — extra fee)"}
            {!deliveryAvailable ? (
              <span className="text-xs text-muted-foreground">
                (not offered)
              </span>
            ) : null}
          </label>
        </fieldset>

        {pickup === "delivery" ? (
          addressDelivery ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="bp-address">Delivery address</Label>
                <AddressAutocomplete
                  id="bp-address"
                  onSelect={setDeliveryAddr}
                  onClear={() => setDeliveryAddr(null)}
                />
                <p className="text-xs text-muted-foreground">
                  Fee from {formatMoneyCents(car.branch.deliveryBaseFeeCents)} +{" "}
                  {formatMoneyCents(car.branch.deliveryPerKmCents)}/km
                  {car.branch.deliveryMaxKm
                    ? ` · within ${car.branch.deliveryMaxKm} km`
                    : ""}
                  .
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp-ref">Reference (optional)</Label>
                <Input
                  id="bp-ref"
                  placeholder="e.g. blue gate, ring twice"
                  value={deliveryReference}
                  maxLength={300}
                  onChange={(e) => setDeliveryReference(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="bp-zone">Delivery zone</Label>
              <Select
                id="bp-zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              >
                <option value="">Select a zone</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} (+{formatMoneyCents(z.feeCents)})
                  </option>
                ))}
              </Select>
            </div>
          )
        ) : null}

        {/* Server-side quote — rendered verbatim, never computed here. */}
        {quoteReady ? (
          quoteQuery.isLoading ? (
            <LoadingState label="Getting your quote…" className="py-4" />
          ) : quoteQuery.isError ? (
            <ErrorState
              title="Quote unavailable"
              message={describeRequestError(quoteQuery.error).message}
              onRetry={() => quoteQuery.refetch()}
              className="py-4"
            />
          ) : quote ? (
            <dl className="space-y-1.5 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-4 text-sm">
              <div className="flex justify-between">
                <dt>
                  {quote.days} day{quote.days === 1 ? "" : "s"} x{" "}
                  {formatMoneyCents(quote.ratePerDayCents, quote.currency)}
                </dt>
                <dd>{formatMoneyCents(quote.subtotalCents, quote.currency)}</dd>
              </div>
              {quote.deliveryFeeCents > 0 ? (
                <div className="flex justify-between">
                  <dt>Delivery fee</dt>
                  <dd>
                    {formatMoneyCents(quote.deliveryFeeCents, quote.currency)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <dt>Service fee ({formatPct(quote.commissionPct)})</dt>
                <dd>
                  {formatMoneyCents(quote.commissionCents, quote.currency)}
                </dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatMoneyCents(quote.totalCents, quote.currency)}</dd>
              </div>
              {car.depositCents > 0 ? (
                <div className="flex justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                  <dt>Security deposit (held at check-in, not charged)</dt>
                  <dd>{formatMoneyCents(car.depositCents, quote.currency)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose dates
            {pickup === "delivery"
              ? addressDelivery
                ? " and a delivery address"
                : " and a zone"
              : ""}{" "}
            to see the total.
          </p>
        )}

        {/* Which saved card takes the hold — compact selector, defaulting to
            the backend's own default (the most recently saved card). */}
        {status === "authenticated" && isVerified && hasCard ? (
          <div className="space-y-1.5">
            <Label htmlFor="bp-card">Pay with</Label>
            <Select
              id="bp-card"
              value={selectedCard?.id ?? ""}
              onChange={(e) => setSelectedCardId(e.target.value)}
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCardOption(c)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              The hold is placed on this card and only captured when the
              agency accepts.
              {car.depositCents > 0
                ? " The security deposit is held on the same card at check-in."
                : ""}
            </p>
          </div>
        ) : null}

        {/* Proactive gate warnings (the server blocks all of them too). */}
        {licenseExpiryBeforeReturn ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Your driver&apos;s license expires on{" "}
              {formatIsoDate(licenseExpiryBeforeReturn)}, before this rental
              ends. Renew your license or choose an earlier return date.
            </span>
          </p>
        ) : null}
        {tooYoung ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {car.agency.name} requires drivers to be at least{" "}
              {car.agency.minDriverAge} on the pickup date, so this car cannot
              be requested with your date of birth on file.
            </span>
          </p>
        ) : null}
        {dobMissing ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Agencies check a minimum driver age.{" "}
              <Link
                href="/account/verification"
                className="font-medium underline underline-offset-2"
              >
                Add your date of birth
              </Link>{" "}
              to your verification before requesting.
            </span>
          </p>
        ) : null}

        {status === "authenticated" && isVerified && hasCard ? (
          <TermsCheckbox
            id="bp-terms"
            inputProps={{
              checked: acceptTerms,
              onChange: (e) => {
                setAcceptTerms(e.target.checked);
                if (e.target.checked) setTermsError(null);
              },
            }}
            disabled={!legalReady}
            error={termsError ?? undefined}
            label={
              <>
                I agree to the{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Terms of Service
                </Link>
                , the cancellation policy and {car.agency.name}&apos;s rental
                conditions above.
              </>
            }
            hint={
              legal.isLoading ? (
                "Loading the current terms…"
              ) : legal.isError ? (
                <>
                  The current terms could not be loaded.{" "}
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2"
                    onClick={() => legal.refetch()}
                  >
                    Try again
                  </button>
                </>
              ) : null
            }
          />
        ) : null}

        {status !== "authenticated" ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={() =>
              router.push(
                `/auth/login?next=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? window.location.pathname + window.location.search
                    : "/",
                )}`,
              )
            }
          >
            Log in to request
          </Button>
        ) : verifQuery.isLoading || cardsQuery.isLoading ? (
          <Button className="w-full" disabled>
            Checking eligibility…
          </Button>
        ) : verifQuery.isError || cardsQuery.isError ? (
          <div className="space-y-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              We could not check your booking eligibility. Please try again.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (verifQuery.isError) void verifQuery.refetch();
                if (cardsQuery.isError) void cardsQuery.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : !isVerified ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => router.push("/account/verification")}
          >
            Verify your identity to book
          </Button>
        ) : !hasCard ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => router.push("/account/payment-methods")}
          >
            Add a payment method to book
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={
              !quoteReady ||
              quoteQuery.isLoading ||
              quoteQuery.isError ||
              licenseExpiryBeforeReturn !== null ||
              tooYoung ||
              dobMissing ||
              !legalReady ||
              requestMutation.isPending ||
              paymentBusy
            }
            onClick={openSignStep}
          >
            {requestMutation.isPending
              ? "Sending request…"
              : payment.phase.step === "challenge"
                ? "Waiting for your bank…"
                : payment.phase.step === "verifying"
                  ? "Verifying your payment…"
                  : "Review agreement and request"}
          </Button>
        )}

        <RentalAgreementSignDialog
          open={signOpen}
          onClose={() => setSignOpen(false)}
          quoteInput={quoteInput}
          agencyName={car.agency.name}
          carLabel={`${car.make.name} ${car.model.name} ${car.year}`}
          onSign={(signature) => {
            const termsVersion = legal.data?.termsVersion;
            // The request button stays disabled until the terms load.
            if (termsVersion === undefined) return;
            requestMutation.mutate({ signature, termsVersion });
          }}
          signing={requestMutation.isPending}
          error={requestError}
        />

        {/* 3DS in flight: the bank challenge is open in Stripe's window. */}
        {payment.phase.step === "challenge" ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            Your bank asked for extra verification. Complete the challenge in
            the window that just opened — we&apos;ll take it from there.
          </p>
        ) : null}

        {/* Challenge passed; the payment is being confirmed server-side. */}
        {payment.phase.step === "verifying" ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
            Verifying your payment… this usually takes a few seconds. Please
            keep this page open.
          </p>
        ) : null}

        {/* Payment failed / could not be verified — honest, no charge made. */}
        {payment.phase.step === "failed" ? (
          <div className="space-y-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">{payment.phase.message}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => payment.reset()}
            >
              Try again
            </Button>
          </div>
        ) : null}

        {status !== "authenticated" ? null : !isVerified &&
          !verifQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">
            A one-time identity check is required before your first booking.
          </p>
        ) : null}

        {requestError && !signOpen ? (
          <div
            className="space-y-2 rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3"
            role="alert"
          >
            <p className="text-sm text-red-700">{requestError.message}</p>
            {requestError.action ? (
              <Link
                href={requestError.action.href}
                className="inline-flex text-sm font-medium text-red-800 underline underline-offset-2"
              >
                {requestError.action.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          You will not be charged until the agency accepts. Your card is
          authorized at request and captured on acceptance; the agency has 24
          hours to answer, after which the request expires and the hold is
          released. You review and sign the rental agreement before the
          request is sent.
        </p>

        <CancellationPolicySummary variant="inline" className="text-xs" />
      </CardContent>
    </Card>
  );
}

/** "Visa •••• 4242 — expires 12/2027" for the card `<option>` rows. */
function formatCardOption(c: PaymentMethod): string {
  const brand = c.brand
    ? c.brand.charAt(0).toUpperCase() + c.brand.slice(1)
    : "Card";
  const month = String(c.expMonth).padStart(2, "0");
  return `${brand} •••• ${c.last4} — expires ${month}/${c.expYear}`;
}
