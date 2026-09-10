"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  Palette,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CarsApi, carKeys } from "@/features/cars/api";
import { BookingsApi } from "@/features/bookings/api";
import { useRequestPayment } from "@/features/bookings/use-request-payment";
import {
  PaymentMethodsApi,
  paymentMethodKeys,
} from "@/features/payments/api";
import { VerificationApi, verificationKeys } from "@/features/verification/api";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { carGallery } from "@/features/cars/photos";
import { CarPhotoPlaceholder } from "@/features/cars/components/car-photo-placeholder";
import { useAuthStore } from "@/shared/auth/store";
import type {
  CarDetail as CarDetailShape,
  PaymentMethod,
  PickupType,
} from "@/shared/types/domain";
import { formatMoneyCents, formatPct } from "@/shared/utils/money";
import { formatIsoDate, todayIso } from "@/shared/utils/dates";
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

  if (carQuery.isLoading) return <LoadingState label="Loading car…" />;
  if (carQuery.isError) {
    return (
      <ErrorState
        title="Could not load this car"
        message={carQuery.error.message}
        onRetry={() => carQuery.refetch()}
      />
    );
  }

  const car = carQuery.data!;
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

        <p className="mt-2 text-sm text-muted-foreground">
          Offered by{" "}
          <Link
            href={`/agencies/${car.agency.slug}`}
            className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {car.agency.name}
          </Link>
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

        <AvailabilityCalendar carId={carId} />
      </div>

      <BookingPanel car={car} initialFrom={initialFrom} initialTo={initialTo} />
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
            unoptimized
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
                unoptimized
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Availability list for the next ~60 days: renders the server's blocked
 * windows (`Availability.occupied`, `Period[]`). The server owns
 * availability; this UI only reflects it — the booking panel's server
 * quote has the final word on any conflict.
 */
function AvailabilityCalendar({ carId }: { carId: string }) {
  const from = todayIso();
  const to = addDaysIso(from, 60);

  const query = useQuery({
    queryKey: carKeys.availability(carId, from, to),
    queryFn: () => CarsApi.availability(carId, from, to),
  });

  const occupied = query.data?.occupied ?? [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          Availability (next 60 days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <LoadingState label="Loading availability…" className="py-6" />
        ) : query.isError ? (
          <p className="text-sm text-muted-foreground">
            Availability could not be loaded. You can still request dates —
            the server always has the final word on conflicts.
          </p>
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

/**
 * Booking panel: date range + pickup choice (branch | delivery-with-zone)
 * + SERVER-computed quote (POST /bookings/quote) + saved-card choice (the
 * selected id travels as `paymentMethodId`; the hold is placed on exactly
 * that card, defaulting to the backend's default = most recently saved).
 * The client never multiplies days x rate — it renders the returned Pricing
 * verbatim.
 *
 * Delivery zones come embedded in `CarDetail` — no extra request.
 */
function BookingPanel({
  car,
  initialFrom,
  initialTo,
}: {
  car: CarDetailShape;
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

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

  // Identity gate: only a VERIFIED customer with a valid licence can rent.
  // The server enforces it (assertCanRent); we read `/verification/me` to show
  // the right CTA up front instead of letting the request 403.
  const verifQuery = useQuery({
    queryKey: verificationKeys.me(),
    queryFn: VerificationApi.me,
    enabled: status === "authenticated",
  });
  const verification = verifQuery.data?.verification;
  const isVerified = verification?.status === "verified";

  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [pickup, setPickup] = useState<PickupType>("branch_pickup");
  const [zoneId, setZoneId] = useState<string>("");
  const [deliveryAddr, setDeliveryAddr] = useState<PickedAddress | null>(null);
  const [deliveryReference, setDeliveryReference] = useState("");

  const zones = car.deliveryZones;
  // Address-based delivery when the branch enables it; else legacy zones (if any).
  const addressDelivery = car.branch.deliveryEnabled;
  const deliveryAvailable = addressDelivery || zones.length > 0;

  const deliveryReady = addressDelivery ? !!deliveryAddr : !!zoneId;
  const quoteReady =
    !!from && !!to && (pickup === "branch_pickup" || deliveryReady);

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
    queryFn: () =>
      BookingsApi.quote({
        carId: car.id,
        start: from,
        end: to,
        pickupType: pickup,
        ...deliveryParams,
      }),
    enabled: quoteReady,
  });

  // Payment outcome state machine: `authorized` → redirect; `requires_action`
  // → Stripe 3DS challenge + "Verifying…" poll; `failed` → honest error.
  const payment = useRequestPayment({
    onAuthorized: (bookingId) => router.push(`/account/bookings/${bookingId}`),
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      BookingsApi.request({
        carId: car.id,
        start: from,
        end: to,
        pickupType: pickup,
        ...deliveryParams,
        // Always send the card the customer sees selected — even the default —
        // so what's displayed is exactly what gets the hold.
        paymentMethodId: selectedCard?.id,
      }),
    onSuccess: (booking) => payment.start(booking),
  });

  const paymentBusy =
    payment.phase.step === "challenge" || payment.phase.step === "verifying";

  const quote = quoteQuery.data;

  // A verified customer whose licence expires before the chosen return date is
  // blocked server-side (assertCanRent). Warn + disable proactively.
  const licenceExpiresBeforeReturn =
    isVerified &&
    !!verification?.licenseExpiry &&
    !!to &&
    verification.licenseExpiry < to;

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
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="bp-from">Pickup</Label>
            <Input
              id="bp-from"
              type="date"
              min={todayIso()}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bp-to">Return</Label>
            <Input
              id="bp-to"
              type="date"
              min={from || todayIso()}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>

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
              message={quoteQuery.error.message}
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
            to see
            the total.
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
            </p>
          </div>
        ) : null}

        {/* Proactive licence-window warning (server blocks it too). */}
        {licenceExpiresBeforeReturn ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your driver&apos;s licence expires on{" "}
            {formatIsoDate(verification!.licenseExpiry!)}, before this rental
            ends. Renew your licence or choose an earlier return date.
          </p>
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
              licenceExpiresBeforeReturn ||
              requestMutation.isPending ||
              paymentBusy
            }
            onClick={() => {
              payment.reset(); // clear a previous failed attempt, if any
              requestMutation.mutate();
            }}
          >
            {requestMutation.isPending
              ? "Sending request…"
              : payment.phase.step === "challenge"
                ? "Waiting for your bank…"
                : payment.phase.step === "verifying"
                  ? "Verifying your payment…"
                  : "Request to book"}
          </Button>
        )}

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

        {requestMutation.isError ? (
          <p className="text-sm text-red-600">{requestMutation.error.message}</p>
        ) : null}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          You will not be charged until the agency accepts. Your card is
          authorized at request and captured on acceptance.
        </p>
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

/** Add N days to a YYYY-MM-DD string (UTC-safe, display/query helper only). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
