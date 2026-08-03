"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { usePermission } from "@/features/agency/use-permission";
import { todayIso } from "@/shared/utils/dates";
import {
  AddressAutocomplete,
  type PickedAddress,
} from "@/shared/components/address-autocomplete";
import { EmptyState } from "@/shared/components/states";
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
 * is at the branch. The booking is created AS the customer (by email), so their
 * identity + card gates apply exactly as a normal request — the server returns
 * a clear error if the customer isn't verified or has no card on file.
 */
export default function WalkInBookingPage() {
  const router = useRouter();
  const { can } = usePermission();

  const fleetQuery = useQuery({
    queryKey: agencyKeys.fleet({ status: "active" }),
    queryFn: () => AgencyApi.fleet({ status: "active" }),
  });

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
              deliveryReference: reference.trim() || undefined,
            }
          : {}),
      }),
    // The counter booking is confirmed and now blocks the calendar — take the
    // salesperson there so they see it land.
    onSuccess: () => router.push("/agency/calendar"),
  });

  if (!can("bookings:handle")) {
    return (
      <EmptyState
        title="Not available"
        description="You need the bookings permission to create counter sales."
      />
    );
  }

  const ready =
    !!carId &&
    /.+@.+\..+/.test(customerEmail) &&
    !!from &&
    !!to &&
    to > from &&
    (!deliver || !!addr);

  const cars = fleetQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl text-foreground">Walk-in sale</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Book a car for a customer at the counter. Enter an existing customer&apos;s
        email, or a new one&apos;s details to register them on the spot. This is
        an offline sale — you collect payment and check the licence yourself; the
        car is reserved so the app can&apos;t double-book it.
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
              If this email already has an account we&apos;ll use it; otherwise a
              new customer is created from the name &amp; phone below.
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
              disabled={fleetQuery.isLoading}
              onChange={(e) => setCarId(e.target.value)}
            >
              <option value="">Select a car</option>
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
                min={todayIso()}
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wi-to">Return</Label>
              <Input
                id="wi-to"
                type="date"
                min={from || todayIso()}
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
