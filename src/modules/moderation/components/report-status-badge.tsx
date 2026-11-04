import { reportStatusLabel } from "@/modules/moderation/helpers/moderation.helper";
import type { ReportStatus } from "@/modules/moderation/types/moderation.types";
import { Badge, type BadgeProps } from "@/shared/components/ui/badge";

/**
 * Status of one report, as a badge.
 *
 * The colours say how much attention the row still needs, not whether the
 * outcome was good: `open` is the work queue (warning), `reviewing` is taken
 * (default), and both decided states are quiet — `actioned` and `dismissed`
 * are equally finished, and tinting one of them red would read as a verdict
 * on the REPORT rather than a record of what was done.
 */
const VARIANT: Readonly<Record<ReportStatus, BadgeProps["variant"]>> = {
  open: "warning",
  reviewing: "default",
  actioned: "success",
  dismissed: "secondary",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Badge variant={VARIANT[status]}>{reportStatusLabel(status)}</Badge>;
}
