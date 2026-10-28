"use client";

import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import type { AgencyCancellationCover } from "@/shared/types/domain";
import { formatMoneyCents } from "@/shared/utils/money";
import { formatDateTime } from "@/shared/utils/dates";

/**
 * WHAT CANCELLING COSTS, SHOWN BEFORE THE HOST PULLS THE TRIGGER.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Accepting a booking takes a car off the market and turns other renters
 * away, so dropping it afterwards carries a cover. The server works that
 * out when the cancellation is already done — too late to tell anybody — so
 * without this panel the first a host hears of it is their wallet. Correct
 * arithmetic arriving as a surprise is a trap, however correct it is.
 *
 * ── WHY IT IS NOT A PENALTY ON SCREEN ─────────────────────────────────────
 *
 * Because none of it is Cibaura's money: one slice reimburses the fee the
 * card processor keeps on the refund, the other reaches the renter. The
 * wording follows the fact — the agency COVERS the renter — and the
 * breakdown is shown precisely so nobody has to take that on trust.
 *
 * ── THE TWO DATES ─────────────────────────────────────────────────────────
 *
 * `chargeableFrom` is when the renter's card is charged, after which this
 * stops being free. `lateFrom` is when it doubles. Both are the reason a
 * host picks up the phone today instead of hoping the mechanic finishes —
 * which is the behaviour the whole tier system exists to buy.
 *
 * ── WHY IT TAKES THE QUOTE RATHER THAN FETCHING IT ───────────────────────
 *
 * Because the dialog's confirm button carries the same figure, and two
 * components asking one question is two answers that can disagree — the
 * panel saying $10.00 above a button that says $18.40. The owner of the
 * dialog asks once and both render from it.
 */
export function CancellationCoverNotice({
  cover,
  isLoading,
  isError,
}: {
  cover: AgencyCancellationCover | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Checking what this would cost…
      </p>
    );
  }

  // A quote that could not be fetched must not become silence: silence reads
  // as "free". The host is told the figure is unknown, and may still cancel —
  // blocking the action because a READ failed would be worse.
  if (isError || !cover) {
    return (
      <Panel tone="muted" icon={Info}>
        We could not work out what this cancellation costs. You can still
        cancel; the amount will appear in your wallet.
      </Panel>
    );
  }

  return cover.tier === "nothing_captured" ? (
    <FreeCover cover={cover} />
  ) : (
    <ChargedCover cover={cover} />
  );
}

/** Nothing has been charged to the renter, so there is nothing to cover. */
function FreeCover({ cover }: { cover: AgencyCancellationCover }) {
  return (
    <div className="space-y-2">
      <Panel tone="success" icon={CheckCircle2}>
        <strong className="font-medium">
          Right now there is nothing to cover.
        </strong>{" "}
        The renter&apos;s card has only been held, never charged, so the
        processor keeps no fee — and they still have their whole window to
        book something else.
      </Panel>
      {cover.chargeableFrom ? (
        <Panel tone="warning" icon={Clock}>
          Free until <strong>{formatDateTime(cover.chargeableFrom)}</strong>,
          when their card is charged. After that, covering them comes to{" "}
          <strong>{money(cover.lateCoverCents, cover)}</strong> at most.
        </Panel>
      ) : null}
    </div>
  );
}

/** The money moved, so the cover applies — with where every cent goes. */
function ChargedCover({ cover }: { cover: AgencyCancellationCover }) {
  return (
    <div className="space-y-2">
      <Panel tone={cover.tier === "late" ? "danger" : "warning"} icon={AlertTriangle}>
        <strong className="font-medium">
          Covering the renter comes to {money(cover.coverCents, cover)}.
        </strong>{" "}
        Their card was already charged, so refunding it is not free.
      </Panel>

      <dl className="rounded-[var(--radius)] border border-border text-sm">
        <Line
          label="Processing fee"
          hint="the card processor keeps this either way"
          value={money(cover.processingFeeCents, cover)}
        />
        <Line
          label="Credit for the renter"
          hint="so they can book again"
          value={money(cover.renterCreditCents, cover)}
          last
        />
      </dl>

      {cover.lateFrom ? (
        <Panel tone="danger" icon={Clock}>
          From <strong>{formatDateTime(cover.lateFrom)}</strong> covering them
          comes to <strong>{money(cover.lateCoverCents, cover)}</strong>,
          because by then they are unlikely to find another car.
        </Panel>
      ) : null}
    </div>
  );
}

function Line({
  label,
  hint,
  value,
  last = false,
}: {
  label: string;
  hint: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 px-3 py-2 ${
        last ? "" : "border-b border-border"
      }`}
    >
      <dt className="text-muted-foreground">
        {label}
        <span className="block text-xs text-muted-foreground/80">{hint}</span>
      </dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

const TONES = {
  success: "border-success/30 bg-success-soft text-success",
  warning: "border-warning/30 bg-warning-soft text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
} as const;

function Panel({
  tone,
  icon: Icon,
  children,
}: {
  tone: keyof typeof TONES;
  icon: typeof Info;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-[var(--radius)] border p-3 text-sm ${TONES[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="[&>strong]:font-semibold">{children}</p>
    </div>
  );
}

function money(cents: number, cover: AgencyCancellationCover): string {
  return formatMoneyCents(cents, cover.currency);
}

/**
 * The confirm button's words.
 *
 * THE AMOUNT GOES IN THE BUTTON, not only in the panel above it. A host who
 * reads the panel and then clicks a button that just says "Cancel booking"
 * has still clicked a button that says nothing — and the panel is exactly
 * what a hurried person skips. While the quote is still loading or could
 * not be fetched, it says the plain thing rather than a figure it is not
 * sure of.
 */
export function cancelButtonLabel(
  cover: AgencyCancellationCover | undefined,
): string {
  if (!cover || cover.coverCents === 0) return "Cancel booking";
  return `Cancel and cover ${formatMoneyCents(cover.coverCents, cover.currency)}`;
}
