"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AgencyApi } from "@/features/agency/api";
import { useAllFleet } from "@/features/agency/hooks";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import { businessTodayIso } from "@/shared/utils/dates";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

/**
 * /agency/walk-in — counter sale. A salesperson books a car for a customer who
 * is physically at the branch. It is an OFFLINE, already-accepted booking: the
 * agency takes payment and checks the licence at the counter, so there is NO
 * online card hold and NO identity gate (unlike a normal online request).
 *
 * The email is NOT a login. If it belongs to a REGISTERED account the server
 * refuses it (409) — that customer books from their own account — so this path
 * never attaches a counter sale to an account the customer opened themselves.
 * A prior counter guest with that email is reused; a new email creates a
 * lightweight guest from the name + phone.
 */
export default function WalkInBookingPage() {
  return (
    <PermissionGate permission="bookings:handle">
      <WalkInForm />
    </PermissionGate>
  );
}

function WalkInForm() {
  const router = useRouter();

  // Every ACTIVE car (all pages) — the picker is a plain <select>.
  const fleet = useAllFleet({ status: "active" });

  const [carId, setCarId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deliver, setDeliver] = useState(false);
  const [addr, setAddr] = useState<PickedAddress | null>(null);
  const [reference, setReference] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      AgencyApi.walkInBooking({
        carId,
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        start: from,
        end: to,
        pickupType: deliver ? "delivery" : "branch_pickup",
        ...(deliver && addr
          ? {
              deliveryAddress: addr.formattedAddress,
              deliveryLat: addr.lat,
              deliveryLng: addr.lng,
              deliveryCityName: addr.city,
              deliveryReference: reference.trim() || undefined,
            }
          : {}),
      }),
    // The counter booking is confirmed and now blocks the calendar — take the
    // salesperson there so they see it land.
    onSuccess: () => router.push("/agency/calendar"),
  });

  const ready =
    !!carId &&
    /.+@.+\..+/.test(customerEmail) &&
    !!from &&
    !!to &&
    from >= businessTodayIso() &&
    to > from &&
    (!deliver || !!addr);

  const cars = fleet.cars;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-foreground">Walk-in sale</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Book a car at the counter for a customer who doesn&apos;t have a Cibaura
        account — enter their email and details to register them on the spot. (If
        the email already belongs to a registered account, that customer books
        from their own account instead.) This is an offline sale — you collect
        payment and check the license yourself; the car is reserved so the app
        can&apos;t double-book it.
      </p>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wi-email">Email</Label>
            <Input
              id="wi-email"
              type="email"
              placeholder="customer@email.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Not a login. If this email already belongs to a registered
              account, that customer books from their own account; a previous
              counter guest is reused, otherwise a new one is created from the
              name &amp; phone below.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wi-name">Full name</Label>
              <Input
                id="wi-name"
                placeholder="Juan Pérez"
                value={customerName}
                maxLength={160}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-phone">Phone</Label>
              <Input
                id="wi-phone"
                type="tel"
                placeholder="809-555-0123"
                value={customerPhone}
                maxLength={32}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Reservation details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wi-car">Car</Label>
            <Select
              id="wi-car"
              value={carId}
              disabled={fleet.isLoading}
              onChange={(e) => setCarId(e.target.value)}
            >
              <option value="">
                {fleet.isLoading
                  ? "Loading cars…"
                  : fleet.isError
                    ? "Could not load your fleet"
                    : cars.length === 0
                      ? "No active cars"
                      : "Select a car"}
              </option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.make.name} {c.model.name} {c.year}
                  {c.plate ? ` · ${c.plate}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wi-from">Pickup</Label>
              <Input
                id="wi-from"
                type="date"
                min={businessTodayIso()}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-to">Return</Label>
              <Input
                id="wi-to"
                type="date"
                min={from || businessTodayIso()}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={deliver}
              onChange={(e) => setDeliver(e.target.checked)}
            />
            Deliver to the customer&apos;s address (branch must offer delivery)
          </label>
          {deliver ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Delivery address</Label>
                <AddressAutocomplete
                  onSelect={setAddr}
                  onClear={() => setAddr(null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wi-ref">Reference (optional)</Label>
                <Input
                  id="wi-ref"
                  placeholder="e.g. blue gate, ring twice"
                  value={reference}
                  maxLength={300}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {mutation.isError ? (
            <p className="text-sm text-destructive">
              {(mutation.error as Error).message}
            </p>
          ) : null}

          <Button
            className="w-full"
            disabled={!ready || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating booking…" : "Create booking"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
