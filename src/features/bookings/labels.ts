import type {
  ClaimStatus,
  DepositStatus,
  InspectionStatus,
} from "@/shared/types/domain";

/**
 * CUSTOMER-facing status copy for the v1-expansion lifecycles (deposit,
 * inspection, claim) — worded from the renter's point of view ("Awaiting
 * your confirmation"). Viewer-neutral labels (inspection type, media label,
 * fuel gauge, settlement case) live in `shared/utils/lifecycle-labels.ts`;
 * the host/admin wording in `shared/components/claim-deposit-labels.tsx`.
 * Every DTO carries these as plain strings, so each helper falls back to
 * the raw value — a new backend value never blanks a badge.
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
