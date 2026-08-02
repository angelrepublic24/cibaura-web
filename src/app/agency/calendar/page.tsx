"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import { currentMonth, todayIso } from "@/shared/utils/dates";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Badge } from "@/shared/components/ui/badge";
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
import { Textarea } from "@/shared/components/ui/textarea";

/**
 * /agency/calendar — occupancy per car (bookings + manual blocks) with
 * the MANUAL BLOCK affordance: how agencies register phone/WhatsApp
 * rentals so offline and app bookings can never collide (both live in
 * the same CarOccupancy table behind the DB exclusion constraint; an
 * overlap comes back as a 409).
 *
 * The month-grid visual calendar replaces this list view later; the
 * data contract is final.
 */
export default function AgencyCalendarPage() {
  const qc = useQueryClient();
  const month = currentMonth();
  const [carId, setCarId] = useState<string>("");
  const [showBlockForm, setShowBlockForm] = useState(false);

  const fleetQuery = useQuery({
    queryKey: agencyKeys.fleet(),
    queryFn: () => AgencyApi.fleet(),
  });

  const calendarQuery = useQuery({
    queryKey: agencyKeys.calendar(carId || null, month),
    queryFn: () => AgencyApi.calendar(carId || null, month),
  });

  const deleteBlock = useMutation({
    mutationFn: (blockId: string) => AgencyApi.deleteManualBlock(blockId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: agencyKeys.calendar(carId || null, month) }),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Calendar ({month})</h1>
        <Button onClick={() => setShowBlockForm((v) => !v)}>
          {showBlockForm ? "Close" : "Add manual block"}
        </Button>
      </div>

      <div className="mt-4 max-w-xs space-y-1.5">
        <Label htmlFor="cal-car">Car</Label>
        <Select
          id="cal-car"
          value={carId}
          disabled={fleetQuery.isLoading}
          onChange={(e) => setCarId(e.target.value)}
        >
          <option value="">All cars</option>
          {(fleetQuery.data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.make?.name ?? "Car"} {c.model?.name ?? ""} {c.year}
              {c.plate ? ` — ${c.plate}` : ""}
            </option>
          ))}
        </Select>
      </div>

      {showBlockForm ? (
        <ManualBlockForm
          cars={fleetQuery.data?.items ?? []}
          onDone={() => {
            setShowBlockForm(false);
            qc.invalidateQueries({
              queryKey: agencyKeys.calendar(carId || null, month),
            });
          }}
        />
      ) : null}

      <div className="mt-6">
        {calendarQuery.isLoading ? (
          <LoadingState label="Loading occupancy…" />
        ) : calendarQuery.isError ? (
          <ErrorState
            title="Could not load the calendar"
            message={calendarQuery.error.message}
            onRetry={() => calendarQuery.refetch()}
          />
        ) : (calendarQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="Nothing on the calendar this month"
            description="Accepted bookings and manual blocks will show up here."
          />
        ) : (
          <div className="space-y-2">
            {calendarQuery.data!.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={o.source === "booking" ? "success" : "warning"}
                  >
                    {o.source === "booking" ? "Booking" : "Manual block"}
                  </Badge>
                  <span>
                    {o.startDate} → {o.endDate}
                  </span>
                  {o.note ? (
                    <span className="text-muted-foreground">{o.note}</span>
                  ) : null}
                </div>
                {o.source === "manual_block" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteBlock.isPending}
                    onClick={() => deleteBlock.mutate(o.id)}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Month-grid calendar placeholder — the visual grid lands in a later
        iteration. Conflicts are always enforced by the database, never by
        this screen.
      </p>
    </div>
  );
}

function ManualBlockForm({
  cars,
  onDone,
}: {
  cars: { id: string; year: number; plate?: string; make?: { name: string }; model?: { name: string } }[];
  onDone: () => void;
}) {
  const [blockCarId, setBlockCarId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      AgencyApi.createManualBlock({
        carId: blockCarId,
        from,
        to,
        note: note || undefined,
      }),
    onSuccess: onDone,
  });

  const ready = !!blockCarId && !!from && !!to;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">New manual block</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Rented the car by phone or WhatsApp? Block the dates here so the
          app can never double-book it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mb-car">Car</Label>
            <Select
              id="mb-car"
              value={blockCarId}
              onChange={(e) => setBlockCarId(e.target.value)}
            >
              <option value="">Select a car</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.make?.name ?? "Car"} {c.model?.name ?? ""} {c.year}
                  {c.plate ? ` — ${c.plate}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-from">From</Label>
            <Input
              id="mb-from"
              type="date"
              min={todayIso()}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-to">To (exclusive)</Label>
            <Input
              id="mb-to"
              type="date"
              min={from || todayIso()}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mb-note">Note (optional)</Label>
            <Textarea
              id="mb-note"
              placeholder="e.g. WhatsApp rental — Juan P."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        {mutation.isError ? (
          <p className="mt-3 text-sm text-red-600">
            {mutation.error.message} (overlapping dates are rejected by the
            database)
          </p>
        ) : null}

        <Button
          className="mt-4"
          disabled={!ready || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Blocking…" : "Block dates"}
        </Button>
      </CardContent>
    </Card>
  );
}
