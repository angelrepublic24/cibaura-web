import { Badge } from "@/shared/components/ui/badge";
import type { BookingState } from "@/shared/types/domain";

const STATE_META: Record<
  BookingState,
  { label: string; variant: "secondary" | "success" | "warning" | "destructive" }
> = {
  requested: { label: "Requested", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  active: { label: "Active", variant: "success" },
  returned: { label: "Returned", variant: "secondary" },
  settled: { label: "Settled", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function BookingStateBadge({ state }: { state: BookingState }) {
  const meta = STATE_META[state] ?? { label: state, variant: "secondary" as const };
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
