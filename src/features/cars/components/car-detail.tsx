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
  MapPin,
  Palette,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CarsApi, carKeys } from "@/features/cars/api";
import { BookingsApi } from "@/features/bookings/api";
import {
  PaymentMethodsApi,
  paymentMethodKeys,
} from "@/features/payments/api";
import { carGallery } from "@/features/cars/photos";
import { useAuthStore } from "@/shared/auth/store";
import type { CarDetail as CarDetailShape, PickupType } from "@/shared/types/domain";
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
            — {car.branch.address}, {car.branch.city.name}
          </span>
        </div>

        <AvailabilityCalendar carId={carId} />
      </div>

      <BookingPanel car={car} initialFrom={initialFrom} initialTo={initialTo} />
    </div>
  );
}

/**
 * Photo gallery from `carGallery(car)` — real uploaded photos when present,
 * otherwise deterministic category stock images (never bare). Large hero
 * lead image + a thumbnail strip.
 */
function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const lead = photos[active] ?? photos[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-lg)] bg-muted shadow-sm">
        <Image
          src={lead}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
          priority
          unoptimized
        />
      </div>
      {photos.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {photos.slice(0, 4).map((src, i) => (
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
 * availability; this UI only reflects it. A real month-grid replaces the
 * list later — the `{ start, end }` contract is already final.
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
          Calendar grid placeholder — month navigation and day-level view
          land with the booking flow iteration. Occupied ranges are
          half-open: the car is free again on the end date.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Booking panel: date range + pickup choice (branch | delivery-with-zone)
 * + SERVER-computed quote (POST /bookings/quote). The client never
 * multiplies days x rate — it renders the returned Pricing verbatim.
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
  const hasCard = (cardsQuery.data?.length ?? 0) > 0;

  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [pickup, setPickup] = useState<PickupType>("branch_pickup");
  const [zoneId, setZoneId] = useState<string>("");

  const zones = car.deliveryZones;

  const quoteReady = !!from && !!to && (pickup === "branch_pickup" || !!zoneId);

  const quoteQuery = useQuery({
    queryKey: carKeys.quote(car.id, from, to, pickup, zoneId || undefined),
    queryFn: () =>
      BookingsApi.quote({
        carId: car.id,
        start: from,
        end: to,
        pickupType: pickup,
        deliveryZoneId: pickup === "delivery" ? zoneId : undefined,
      }),
    enabled: quoteReady,
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      BookingsApi.request({
        carId: car.id,
        start: from,
        end: to,
        pickupType: pickup,
        deliveryZoneId: pickup === "delivery" ? zoneId : undefined,
      }),
    onSuccess: (booking) => router.push(`/account/bookings/${booking.id}`),
  });

  const quote = quoteQuery.data;

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
              disabled={zones.length === 0}
              onChange={() => setPickup("delivery")}
            />
            Delivery (airport / hotel zone — extra fee)
            {zones.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                (not offered)
              </span>
            ) : null}
          </label>
        </fieldset>

        {pickup === "delivery" ? (
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
            Choose dates{pickup === "delivery" ? " and a zone" : ""} to see
            the total.
          </p>
        )}

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
        ) : !hasCard && !cardsQuery.isLoading ? (
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
              cardsQuery.isLoading ||
              requestMutation.isPending
            }
            onClick={() => requestMutation.mutate()}
          >
            {requestMutation.isPending ? "Sending request…" : "Request to book"}
          </Button>
        )}

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

/** Add N days to a YYYY-MM-DD string (UTC-safe, display/query helper only). */
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
