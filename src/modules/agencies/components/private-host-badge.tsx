import { UserRound } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import type { AgencyKind } from "@/shared/types/domain";

/**
 * "Private host" marker for `kind = individual` supply (ADR-0009). Renders
 * nothing for businesses — and for payloads that predate the field (a
 * missing `kind` reads as `business`, per the ADR's client rule).
 */
export function PrivateHostBadge({
  kind,
  className,
}: {
  kind: AgencyKind | undefined;
  className?: string;
}) {
  if (kind !== "individual") return null;
  return (
    <Badge variant="accent" className={className}>
      <UserRound className="h-3 w-3" />
      Private host
    </Badge>
  );
}
