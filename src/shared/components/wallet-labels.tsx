import { Badge } from "@/shared/components/ui/badge";
import type { LedgerKind, PayoutStatus } from "@/shared/types/domain";

/** Human labels for the known ledger kinds (agency wallet + admin views). */
const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  settlement: "Booking settlement",
  payout: "Payout",
  refund: "Refund",
  late_cancellation_retention: "Late cancellation retention",
  early_return_refund: "Early return refund",
};

/** Label for a wire `kind`; a kind newer than this client shows verbatim. */
export function ledgerKindLabel(kind: string): string {
  const labels: Record<string, string | undefined> = LEDGER_KIND_LABELS;
  return labels[kind] ?? kind;
}

const PAYOUT_STATUS_META: Record<
  PayoutStatus,
  { label: string; variant: "warning" | "success" | "destructive" }
> = {
  requested: { label: "Requested", variant: "warning" },
  paid: { label: "Paid", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function isPayoutStatus(status: string): status is PayoutStatus {
  return status in PAYOUT_STATUS_META;
}

export function PayoutStatusBadge({ status }: { status: string }) {
  if (!isPayoutStatus(status)) return <Badge variant="secondary">{status}</Badge>;
  const meta = PAYOUT_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
