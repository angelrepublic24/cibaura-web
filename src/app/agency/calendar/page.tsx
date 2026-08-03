"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
} from "lucide-react";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import type { AgencyCar, OccupancyEntry } from "@/shared/types/domain";
import { currentMonth, toIsoDate, todayIso } from "@/shared/utils/dates";
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
import { cn } from "@/lib/utils";

/**
 * /agency/calendar — the agency's occupancy (accepted bookings + manual
 * blocks) as a real month-grid calendar with a List fallback. Accepted
 * requests land here automatically: accepting a request inserts a row into
 * CarOccupancy in the same transaction, so `source: "booking"` entries show
 * up the moment they're accepted (the DB exclusion constraint is what actually
 * prevents double-booking — never this screen).
 */
type View = "month" | "list";

// ── month math (plain Date, local) ─────────────────────────────────────────

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return toIsoDate(new Date(y, m - 1 + delta, 1)).slice(0, 7);
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Six Sun–Sat weeks covering the month grid (Google-Calendar style). */
function monthWeeks(month: string): Date[][] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const cursor = new Date(first);
  cursor.setDate(first.getDate() - first.getDay()); // rewind to Sunday
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/** Entries covering a given ISO day — half-open [start, end). */
function entriesForDay(
  entries: OccupancyEntry[],
  isoDay: string,
): OccupancyEntry[] {
  return entries.filter((e) => e.startDate <= isoDay && isoDay < e.endDate);
}

function carLabel(car: AgencyCar | undefined): string {
  if (!car) return "Car";
  const name = `${car.make?.name ?? "Car"} ${car.model?.name ?? ""}`.trim();
  return car.plate ? `${name} · ${car.plate}` : name;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AgencyCalendarPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState<string>(currentMonth());
  const [carId, setCarId] = useState<string>("");
  const [view, setView] = useState<View>("month");
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
      qc.invalidateQueries({
        queryKey: agencyKeys.calendar(carId || null, month),
      }),
  });

  // carId → label, for booking/block bars under "All cars".
  const carsById = useMemo(() => {
    const map = new Map<string, AgencyCar>();
    for (const c of fleetQuery.data?.items ?? []) map.set(c.id, c);
    return map;
  }, [fleetQuery.data]);

  const entries = calendarQuery.data ?? [];
  const isCurrentMonth = month === currentMonth();

  function invalidate() {
    qc.invalidateQueries({
      queryKey: agencyKeys.calendar(carId || null, month),
    });
  }

  return (
    <div>
      {/* Header: title + view toggle + Add block. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-foreground">Calendar</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("month")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                view === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <CalendarDays className="h-4 w-4" /> Month
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-sm transition-colors",
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <ListIcon className="h-4 w-4" /> List
            </button>
          </div>
          <Button variant="outline" onClick={() => setShowBlockForm((v) => !v)}>
            {showBlockForm ? "Close" : "Add manual block"}
          </Button>
        </div>
      </div>

      {/* Toolbar: month nav + car filter + legend. */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-40 text-center text-base font-semibold text-foreground">
            {monthLabel(month)}
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentMonth ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMonth(currentMonth())}
            >
              Today
            </Button>
          ) : null}
        </div>

        <div className="flex items-end gap-4">
          <div className="w-56 space-y-1.5">
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
                  {carLabel(c)} · {c.year}
                </option>
              ))}
            </Select>
          </div>
          <Legend />
        </div>
      </div>

      {showBlockForm ? (
        <ManualBlockForm
          cars={fleetQuery.data?.items ?? []}
          onDone={() => {
            setShowBlockForm(false);
            invalidate();
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
        ) : view === "month" ? (
          <MonthGrid
            month={month}
            entries={entries}
            carsById={carsById}
            singleCar={!!carId}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nothing on the calendar this month"
            description="Accepted bookings and manual blocks will show up here."
          />
        ) : (
          <OccupancyList
            entries={entries}
            carsById={carsById}
            singleCar={!!carId}
            onRemove={(id) => deleteBlock.mutate(id)}
            removing={deleteBlock.isPending}
          />
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Accepted requests appear here automatically. Conflicts are always
        enforced by the database, never by this screen.
      </p>
    </div>
  );
}

// ── legend ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-3 pb-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Booking
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Manual block
      </span>
    </div>
  );
}

// ── month grid ───────────────────────────────────────────────────────────────

function MonthGrid({
  month,
  entries,
  carsById,
  singleCar,
}: {
  month: string;
  entries: OccupancyEntry[];
  carsById: Map<string, AgencyCar>;
  singleCar: boolean;
}) {
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const monthIndex = Number(month.split("-")[1]) - 1;
  const today = todayIso();

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-sm">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid grid-cols-7">
        {weeks.flat().map((date, i) => {
          const iso = toIsoDate(date);
          const inMonth = date.getMonth() === monthIndex;
          const isToday = iso === today;
          const dayEntries = entriesForDay(entries, iso);
          const shown = dayEntries.slice(0, 3);
          const extra = dayEntries.length - shown.length;
          return (
            <div
              key={iso}
              className={cn(
                "min-h-24 border-b border-r border-border p-1.5",
                i % 7 === 6 && "border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="mt-0.5 space-y-1">
                {shown.map((e) => (
                  <DayBar
                    key={e.id}
                    entry={e}
                    label={
                      singleCar
                        ? e.note ?? (e.source === "booking" ? "Booked" : "Blocked")
                        : carLabel(carsById.get(e.carId))
                    }
                  />
                ))}
                {extra > 0 ? (
                  <div className="px-1 text-[11px] text-muted-foreground">
                    +{extra} more
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayBar({ entry, label }: { entry: OccupancyEntry; label: string }) {
  const booking = entry.source === "booking";
  return (
    <div
      title={`${entry.startDate} → ${entry.endDate}${entry.note ? ` · ${entry.note}` : ""}`}
      className={cn(
        "truncate rounded px-1.5 py-0.5 text-[11px] leading-tight",
        booking
          ? "bg-primary/12 text-primary"
          : "bg-amber-500/15 text-amber-700",
      )}
    >
      {label}
    </div>
  );
}

// ── list view (kept from the original placeholder) ──────────────────────────

function OccupancyList({
  entries,
  carsById,
  singleCar,
  onRemove,
  removing,
}: {
  entries: OccupancyEntry[];
  carsById: Map<string, AgencyCar>;
  singleCar: boolean;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  return (
    <div className="space-y-2">
      {entries.map((o) => (
        <div
          key={o.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={o.source === "booking" ? "success" : "warning"}>
              {o.source === "booking" ? "Booking" : "Manual block"}
            </Badge>
            {!singleCar ? (
              <span className="font-medium text-foreground">
                {carLabel(carsById.get(o.carId))}
              </span>
            ) : null}
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
              disabled={removing}
              onClick={() => onRemove(o.id)}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── manual block form (unchanged behaviour) ─────────────────────────────────

function ManualBlockForm({
  cars,
  onDone,
}: {
  cars: AgencyCar[];
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
          Rented the car by phone or WhatsApp? Block the dates here so the app
          can never double-book it.
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
                  {carLabel(c)} · {c.year}
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
