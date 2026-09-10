import { Badge } from "@/shared/components/ui/badge";
import type {
  LedgerKind,
  PayoutAccountStatus,
  PayoutKind,
  PayoutMethod,
  PayoutRailStatus,
  PayoutStatus,
} from "@/shared/types/domain";

type BadgeVariant = "secondary" | "warning" | "success" | "destructive" | "accent";

/** Human labels for the known ledger kinds (agency wallet + admin views). */
const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  settlement: "Booking settlement",
  payout: "Payout",
  refund: "Refund",
  late_cancellation_retention: "Late cancellation retention",
  early_return_refund: "Early return refund",
  retention: "Cancellation retention",
  claim: "Damage claim",
  payout_reversal: "Payout reversal",
};

/** Label for a wire `kind`; a kind newer than this client shows verbatim. */
export function ledgerKindLabel(kind: string): string {
  const labels: Record<string, string | undefined> = LEDGER_KIND_LABELS;
  return labels[kind] ?? kind;
}

const PAYOUT_STATUS_META: Record<
  PayoutStatus,
  { label: string; variant: BadgeVariant }
> = {
  requested: { label: "Requested", variant: "warning" },
  processing: { label: "Processing", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

function isPayoutStatus(status: string): status is PayoutStatus {
  return status in PAYOUT_STATUS_META;
}

export function PayoutStatusBadge({ status }: { status: string }) {
  if (!isPayoutStatus(status)) return <Badge variant="secondary">{status}</Badge>;
  const meta = PAYOUT_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// ── Payout method / kind / rail (ADR-0012) ───────────────────────────────────

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  bank_transfer: "Bank transfer",
  stripe_connect: "Stripe",
};

export function payoutMethodLabel(method: string): string {
  const labels: Record<string, string | undefined> = PAYOUT_METHOD_LABELS;
  return labels[method] ?? method;
}

const PAYOUT_KIND_LABELS: Record<PayoutKind, string> = {
  withdrawal: "Withdrawal",
  settlement: "Settlement",
  advance: "Check-in advance",
};

export function payoutKindLabel(kind: string): string {
  const labels: Record<string, string | undefined> = PAYOUT_KIND_LABELS;
  return labels[kind] ?? kind;
}

const PAYOUT_RAIL_STATUS_META: Record<
  PayoutRailStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending_submit: { label: "Queued for Stripe", variant: "secondary" },
  submitted: { label: "Sent to Stripe", variant: "warning" },
  posted: { label: "Posted to bank", variant: "success" },
  failed: { label: "Failed at Stripe", variant: "destructive" },
  returned: { label: "Returned by bank", variant: "destructive" },
  canceled: { label: "Canceled", variant: "destructive" },
};

function isPayoutRailStatus(status: string): status is PayoutRailStatus {
  return status in PAYOUT_RAIL_STATUS_META;
}

/** Stripe-side status of a `stripe_connect` payout (null for bank transfers). */
export function PayoutRailStatusBadge({ status }: { status: string }) {
  if (!isPayoutRailStatus(status)) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  const meta = PAYOUT_RAIL_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// ── Stripe payout account ────────────────────────────────────────────────────

const PAYOUT_ACCOUNT_STATUS_META: Record<
  PayoutAccountStatus,
  { label: string; variant: BadgeVariant }
> = {
  not_started: { label: "Not set up", variant: "secondary" },
  onboarding: { label: "Setup in progress", variant: "warning" },
  restricted: { label: "Action required", variant: "destructive" },
  active: { label: "Active", variant: "success" },
  disabled: { label: "Disabled", variant: "destructive" },
};

function isPayoutAccountStatus(
  status: string,
): status is PayoutAccountStatus {
  return status in PAYOUT_ACCOUNT_STATUS_META;
}

export function PayoutAccountStatusBadge({ status }: { status: string }) {
  if (!isPayoutAccountStatus(status)) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  const meta = PAYOUT_ACCOUNT_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
