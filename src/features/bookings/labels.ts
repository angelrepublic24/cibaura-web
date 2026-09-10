import type {
  ClaimStatus,
  DepositStatus,
  InspectionStatus,
  InspectionType,
  MediaLabel,
  SettlementCase,
} from "@/shared/types/domain";

/**
 * Human labels for the v1-expansion wire enums (spec §0.1). Every DTO
 * carries these as plain strings, so each helper falls back to the raw
 * value — a new backend value never blanks a badge.
 */

type BadgeTone = "secondary" | "success" | "warning" | "destructive";

const DEPOSIT_STATUS_META: Record<DepositStatus, { label: string; tone: BadgeTone }> = {
  pending_hold: { label: "Hold pending", tone: "warning" },
  requires_action: { label: "Verification needed", tone: "warning" },
  held: { label: "Held", tone: "success" },
  reauthorizing: { label: "Renewing hold", tone: "warning" },
  released: { label: "Released", tone: "success" },
  captured: { label: "Captured", tone: "destructive" },
  lapsed: { label: "Hold expired", tone: "destructive" },
  failed: { label: "Hold failed", tone: "destructive" },
  waived: { label: "No deposit", tone: "secondary" },
};

export function depositStatusMeta(status: string): { label: string; tone: BadgeTone } {
  return (
    DEPOSIT_STATUS_META[status as DepositStatus] ?? {
      label: status,
      tone: "secondary",
    }
  );
}

const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  checkin: "Check-in",
  checkout: "Check-out",
};

export function inspectionTypeLabel(type: string): string {
  return INSPECTION_TYPE_LABELS[type as InspectionType] ?? type;
}

const INSPECTION_STATUS_META: Record<
  InspectionStatus,
  { label: string; tone: BadgeTone }
> = {
  draft: { label: "In preparation", tone: "secondary" },
  submitted: { label: "Awaiting your confirmation", tone: "warning" },
  confirmed: { label: "Confirmed by you", tone: "success" },
  confirmed_absent: { label: "Recorded without you", tone: "secondary" },
  disputed: { label: "Disputed", tone: "destructive" },
  void: { label: "Void", tone: "secondary" },
};

export function inspectionStatusMeta(status: string): {
  label: string;
  tone: BadgeTone;
} {
  return (
    INSPECTION_STATUS_META[status as InspectionStatus] ?? {
      label: status,
      tone: "secondary",
    }
  );
}

const MEDIA_LABEL_LABELS: Record<MediaLabel, string> = {
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
  return MEDIA_LABEL_LABELS[label as MediaLabel] ?? label;
}

/** "Full" / "Empty" / "3/8" — the gauge reading as the host recorded it. */
export function fuelLevelText(eighths: number | null): string {
  if (eighths === null) return "Not recorded";
  if (eighths >= 8) return "Full";
  if (eighths <= 0) return "Empty";
  return `${eighths}/8`;
}

const CLAIM_STATUS_META: Record<ClaimStatus, { label: string; tone: BadgeTone }> = {
  open: { label: "Awaiting your response", tone: "warning" },
  under_review: { label: "Under admin review", tone: "warning" },
  approved: { label: "Approved", tone: "destructive" },
  approved_uncollectible: { label: "Approved — not collected", tone: "destructive" },
  rejected: { label: "Rejected", tone: "success" },
  withdrawn: { label: "Withdrawn by the host", tone: "success" },
};

export function claimStatusMeta(status: string): { label: string; tone: BadgeTone } {
  return (
    CLAIM_STATUS_META[status as ClaimStatus] ?? {
      label: status,
      tone: "secondary",
    }
  );
}

const SETTLEMENT_CASE_LABELS: Record<SettlementCase, string> = {
  completed: "Rental completed",
  early_return: "Returned early",
  cancelled_free: "Cancelled within the free window",
  cancelled_late: "Late cancellation",
  cancelled_by_host: "Cancelled by the host",
  cancelled_mid_rental: "Cancelled during the rental",
  cancelled_requested: "Cancelled before acceptance",
};

export function settlementCaseLabel(settlementCase: string): string {
  return SETTLEMENT_CASE_LABELS[settlementCase as SettlementCase] ?? settlementCase;
}
