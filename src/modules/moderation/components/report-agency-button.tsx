"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

import { ReportDialog } from "@/modules/moderation/components/report-dialog";
import { useModerationGate } from "@/modules/moderation/hooks/use-moderation-gate.hook";
import { cn } from "@/lib/utils";

/**
 * Round "report this agency" button for the storefront header, sized and
 * shaped to sit beside `<FavoriteButton/>` in the same action row.
 *
 * Unlike the heart, THIS RENDERS FOR GUESTS. A public storefront with no
 * visible way to report it reads as a platform that does not take reports;
 * pressing it sends the guest to log in and returns them here.
 *
 * It does NOT render for a signed-in platform_admin: `GET /reports/reasons`
 * and `POST /reports` are closed to their role, so the dialog would open on an
 * empty reason list it could not load. See `useModerationGate`.
 *
 * It opens the dialog directly rather than a menu: this repo has no
 * DropdownMenu primitive, and one round button that does one thing is
 * clearer than inventing one.
 */
export function ReportAgencyButton({
  agencyId,
  agencyName,
  className,
}: {
  agencyId: string;
  agencyName: string;
  className?: string;
}) {
  const { canModerate, gate } = useModerationGate();
  const [open, setOpen] = useState(false);
  const label = `Report ${agencyName}`;

  if (!canModerate) return null;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          gate(() => setOpen(true));
        }}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/90 shadow-sm backdrop-blur transition-colors hover:bg-muted",
          className,
        )}
      >
        <Flag className="h-4 w-4 text-muted-foreground" />
      </button>
      <ReportDialog
        open={open}
        onClose={() => setOpen(false)}
        targetType="agency"
        targetId={agencyId}
        targetName={agencyName}
      />
    </>
  );
}
