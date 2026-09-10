import { Badge } from "@/shared/components/ui/badge";
import type {
  ClaimStatus,
  DepositStatus,
  InspectionStatus,
  InspectionType,
  MediaLabel,
  SettlementCase,
} from "@/shared/types/domain";

type BadgeVariant =
  | "secondary"
  | "warning"
  | "success"
  | "destructive"
  | "accent"
  | "outline";

/**
 * Copy + badge variants for the ADR-0011/0012/0013 lifecycles (inspections,
 * deposits, claims, settlement). Wire values arrive as plain strings; a
 * value newer than this client renders verbatim in a neutral badge so a
 * new backend state never blanks a row.
 */

// ── Deposit ─────────────────────────────────────────────────────────────────

const DEPOSIT_STATUS_META: Record<
  DepositStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending_hold: { label: "Hold pending", variant: "secondary" },
  requires_action: { label: "Customer action required", variant: "warning" },
  held: { label: "Held", variant: "success" },
  reauthorizing: { label: "Re-authorizing", variant: "warning" },
  released: { label: "Released", variant: "secondary" },
  captured: { label: "Captured", variant: "accent" },
  lapsed: { label: "Lapsed", variant: "destructive" },
  failed: { label: "Hold failed", variant: "destructive" },
  waived: { label: "Waived", variant: "outline" },
};

function isDepositStatus(status: string): status is DepositStatus {
  return status in DEPOSIT_STATUS_META;
}

export function depositStatusLabel(status: string): string {
  return isDepositStatus(status) ? DEPOSIT_STATUS_META[status].label : status;
}

export function DepositStatusBadge({ status }: { status: string }) {
  if (!isDepositStatus(status)) return <Badge variant="secondary">{status}</Badge>;
  const meta = DEPOSIT_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// ── Claim ───────────────────────────────────────────────────────────────────

const CLAIM_STATUS_META: Record<
  ClaimStatus,
  { label: string; variant: BadgeVariant }
> = {
  open: { label: "Awaiting customer", variant: "warning" },
  under_review: { label: "Under review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  approved_uncollectible: { label: "Approved · uncollectible", variant: "destructive" },
  rejected: { label: "Rejected", variant: "secondary" },
  withdrawn: { label: "Withdrawn", variant: "secondary" },
};

function isClaimStatus(status: string): status is ClaimStatus {
  return status in CLAIM_STATUS_META;
}

export function claimStatusLabel(status: string): string {
  return isClaimStatus(status) ? CLAIM_STATUS_META[status].label : status;
}

export function ClaimStatusBadge({ status }: { status: string }) {
  if (!isClaimStatus(status)) return <Badge variant="secondary">{status}</Badge>;
  const meta = CLAIM_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

// ── Inspection ──────────────────────────────────────────────────────────────

const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; variant: BadgeVariant }
> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Awaiting customer", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "success" },
  confirmed_absent: { label: "Customer absent", variant: "accent" },
  disputed: { label: "Disputed", variant: "destructive" },
  void: { label: "Void", variant: "outline" },
};

function isInspectionStatus(status: string): status is InspectionStatus {
  return status in INSPECTION_STATUS_META;
}

export function InspectionStatusBadge({ status }: { status: string }) {
  if (!isInspectionStatus(status)) {
    return <Badge variant="secondary">{status}</Badge>;
  }
  const meta = INSPECTION_STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  checkin: "Check-in",
  checkout: "Check-out",
};

export function inspectionTypeLabel(type: string): string {
  const labels: Record<string, string | undefined> = INSPECTION_TYPE_LABELS;
  return labels[type] ?? type;
}

const MEDIA_LABEL_TEXT: Record<MediaLabel, string> = {
  front: "Front",
  rear: "Rear",
  left: "Left side",
  right: "Right side",
  interior: "Interior",
  odometer: "Odometer",
  fuel: "Fuel gauge",
  damage: "Damage",
  other: "Other",
};

export function mediaLabelText(label: string): string {
  const labels: Record<string, string | undefined> = MEDIA_LABEL_TEXT;
  return labels[label] ?? label;
}

// ── Settlement ──────────────────────────────────────────────────────────────

const SETTLEMENT_CASE_LABELS: Record<SettlementCase, string> = {
  completed: "Completed rental",
  early_return: "Early return",
  cancelled_free: "Free cancellation",
  cancelled_late: "Late cancellation",
  cancelled_by_host: "Cancelled by the host",
  cancelled_mid_rental: "Cancelled mid-rental",
  cancelled_requested: "Cancelled before acceptance",
};

export function settlementCaseLabel(settlementCase: string): string {
  const labels: Record<string, string | undefined> = SETTLEMENT_CASE_LABELS;
  return labels[settlementCase] ?? settlementCase;
}
