"use client";

import { useState } from "react";
import { Ban, Flag } from "lucide-react";

import { BlockDialog } from "@/modules/moderation/components/block-dialog";
import { ReportDialog } from "@/modules/moderation/components/report-dialog";
import { useModerationGate } from "@/modules/moderation/hooks/use-moderation-gate.hook";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";

/** The shell every moderation entry point shares: a quiet, bordered block. */
function ModerationBlock({
  title,
  children,
  className,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  actions: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-sm)] border border-border bg-surface p-4",
        className,
      )}
    >
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </section>
  );
}

/**
 * Report a listing and/or report-or-block its agency.
 *
 * `carId` is optional because the same block serves the car page (where the
 * listing itself can be reported) and the booking detail (where it cannot —
 * the renter's complaint there is about the host, not the advert).
 *
 * Renders NOTHING for a signed-in viewer the moderation API refuses (a
 * platform_admin) — see `useModerationGate`. Guests still see it.
 */
export function AgencyModerationActions({
  agencyId,
  agencyName,
  carId,
  title,
  description,
  className,
}: {
  agencyId: string;
  agencyName: string;
  /** When given, a "Report this listing" action is offered too. */
  carId?: string;
  title: string;
  description: React.ReactNode;
  className?: string;
}) {
  const { canModerate, gate } = useModerationGate();
  const [reportCar, setReportCar] = useState(false);
  const [reportAgency, setReportAgency] = useState(false);
  const [block, setBlock] = useState(false);

  if (!canModerate) return null;

  return (
    <ModerationBlock
      title={title}
      className={className}
      actions={
        <>
          {carId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => gate(() => setReportCar(true))}
            >
              <Flag className="h-3.5 w-3.5" />
              Report this listing
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => gate(() => setReportAgency(true))}
          >
            <Flag className="h-3.5 w-3.5" />
            Report agency
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => gate(() => setBlock(true))}
          >
            <Ban className="h-3.5 w-3.5" />
            Block agency
          </Button>
        </>
      }
    >
      {description}
      {carId ? (
        <ReportDialog
          open={reportCar}
          onClose={() => setReportCar(false)}
          targetType="car"
          targetId={carId}
          targetName={`this ${agencyName} listing`}
        />
      ) : null}
      <ReportDialog
        open={reportAgency}
        onClose={() => setReportAgency(false)}
        targetType="agency"
        targetId={agencyId}
        targetName={agencyName}
      />
      <BlockDialog
        open={block}
        onClose={() => setBlock(false)}
        subjectType="agency"
        subjectId={agencyId}
        subjectName={agencyName}
      />
    </ModerationBlock>
  );
}

/**
 * Report or block a PERSON — the host-side counterpart, used on the agency's
 * booking detail against the renter.
 *
 * Blocking a person filters no catalogue (a renter publishes nothing); the
 * only effect is the booking gate, so the copy here claims only that.
 *
 * `canBlock` IS REQUIRED, AND IT IS NOT A PERMISSION BIT. The backend accepts
 * a person-block from the agency OWNER alone (403
 * `MODERATION_BLOCK_OWNER_ONLY`): the booking gate reads the agency's
 * `owner_user_id`, so anyone else's row would bind nothing while looking
 * exactly like a ban in their own block list. Reporting stays open to
 * everybody the backend serves — it is the escalation that reaches a human.
 */
export function PersonModerationActions({
  userId,
  userName,
  title,
  description,
  canBlock,
  className,
}: {
  userId: string;
  userName: string;
  title: string;
  description: React.ReactNode;
  /** Only an agency OWNER may block a person — see above. */
  canBlock: boolean;
  className?: string;
}) {
  const { canModerate, gate } = useModerationGate();
  const [report, setReport] = useState(false);
  const [block, setBlock] = useState(false);

  if (!canModerate) return null;

  return (
    <ModerationBlock
      title={title}
      className={className}
      actions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => gate(() => setReport(true))}
          >
            <Flag className="h-3.5 w-3.5" />
            Report {userName}
          </Button>
          {canBlock ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => gate(() => setBlock(true))}
            >
              <Ban className="h-3.5 w-3.5" />
              Block {userName}
            </Button>
          ) : null}
        </>
      }
    >
      {description}
      <ReportDialog
        open={report}
        onClose={() => setReport(false)}
        targetType="user"
        targetId={userId}
        targetName={userName}
      />
      {canBlock ? (
        <BlockDialog
          open={block}
          onClose={() => setBlock(false)}
          subjectType="user"
          subjectId={userId}
          subjectName={userName}
        />
      ) : null}
    </ModerationBlock>
  );
}
