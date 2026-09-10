import type {
  InspectionType,
  MediaLabel,
  SettlementCase,
} from "@/shared/types/domain";

/**
 * Viewer-NEUTRAL copy for the ADR-0011/0012/0013 lifecycle enums — the
 * labels that read the same for the customer, the host and an admin
 * (inspection type, media label, fuel gauge, settlement case). Status
 * badges whose wording depends on who is looking ("Awaiting your
 * confirmation" vs "Awaiting customer") stay next to their surface:
 * `features/bookings/labels.ts` (customer) and
 * `shared/components/claim-deposit-labels.tsx` (host + admin).
 *
 * Wire values arrive as plain strings; an unknown value renders verbatim so
 * a newer backend enum never blanks a row.
 */

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

/** "Full" / "Empty" / "3/8" — the gauge reading as the host recorded it. */
export function fuelLevelText(eighths: number | null): string {
  if (eighths === null) return "Not recorded";
  if (eighths >= 8) return "Full";
  if (eighths <= 0) return "Empty";
  return `${eighths}/8`;
}

const SETTLEMENT_CASE_LABELS: Record<SettlementCase, string> = {
  completed: "Rental completed",
  early_return: "Early return",
  cancelled_free: "Free cancellation",
  cancelled_late: "Late cancellation",
  cancelled_by_host: "Cancelled by the host",
  cancelled_mid_rental: "Cancelled during the rental",
  cancelled_requested: "Cancelled before acceptance",
};

export function settlementCaseLabel(settlementCase: string): string {
  const labels: Record<string, string | undefined> = SETTLEMENT_CASE_LABELS;
  return labels[settlementCase] ?? settlementCase;
}
