"use client";

import { Camera, Video } from "lucide-react";
import type { InspectionDto, InspectionMediaDto } from "@/shared/types/domain";
import { InspectionStatusBadge } from "@/shared/components/claim-deposit-labels";
import {
  inspectionTypeLabel,
  mediaLabelText,
} from "@/shared/utils/lifecycle-labels";
import { Badge } from "@/shared/components/ui/badge";
import { formatDateTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

/**
 * Evidence viewer for check-in / check-out media (ADR-0011). URLs are
 * SHORT-LIVED signed links minted by the server for parties + admin; a
 * thumbnail opens the full file in a new tab, videos play inline. Media the
 * host attached to a claim as evidence are outlined (`highlightIds`).
 */
export function InspectionMediaGrid({
  media,
  highlightIds,
}: {
  media: InspectionMediaDto[];
  highlightIds?: ReadonlySet<string>;
}) {
  const items = [...media].sort((a, b) => a.position - b.position);
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-dashed border-border bg-muted/40 px-3 py-4 text-sm text-muted-foreground">
        No photos or videos were uploaded for this inspection.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => (
        <MediaTile key={m.id} media={m} evidence={highlightIds?.has(m.id) ?? false} />
      ))}
    </ul>
  );
}

function MediaTile({
  media: m,
  evidence,
}: {
  media: InspectionMediaDto;
  evidence: boolean;
}) {
  const isVideo = m.kind === "video";
  const uploaded = m.status === "uploaded" && !!m.url;
  return (
    <li
      className={cn(
        "overflow-hidden rounded-[var(--radius-sm)] border bg-muted/40",
        evidence ? "border-primary ring-2 ring-primary/30" : "border-border",
      )}
    >
      <div className="relative aspect-[4/3] bg-muted">
        {!uploaded ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            {m.status === "failed" ? "Upload failed" : "Upload pending"}
          </div>
        ) : isVideo ? (
          <video
            src={m.url ?? undefined}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <a
            href={m.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            title="Open full size"
            className="block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL; not optimizable */}
            <img
              src={m.url ?? undefined}
              alt={`${mediaLabelText(m.label)} photo`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </a>
        )}
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-navy/70 px-1.5 py-0.5 text-[11px] text-white">
          {isVideo ? <Video className="h-3 w-3" /> : <Camera className="h-3 w-3" />}
          {mediaLabelText(m.label)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
        <span>
          {isVideo && m.durationSeconds !== null ? `${m.durationSeconds}s` : m.kind}
        </span>
        {evidence ? <Badge variant="accent">Evidence</Badge> : null}
      </div>
    </li>
  );
}

/**
 * One inspection with its facts (odometer, fuel, damage) and media grid.
 * Shared by the claim detail (evidence viewer) and the order detail.
 */
export function InspectionBlock({
  inspection: i,
  highlightIds,
}: {
  inspection: InspectionDto;
  highlightIds?: ReadonlySet<string>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {inspectionTypeLabel(i.type)}
        </h4>
        <InspectionStatusBadge status={i.status} />
      </div>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <Fact label="Odometer" value={i.odometerKm !== null ? `${i.odometerKm.toLocaleString("en-US")} km` : "—"} />
        <Fact
          label="Fuel"
          value={i.fuelLevelEighths !== null ? `${i.fuelLevelEighths}/8` : "—"}
        />
        <Fact
          label="Damage"
          value={i.damageFlagged ? "Flagged by the host" : "None flagged"}
          alert={i.damageFlagged}
        />
        <Fact label="Submitted" value={formatDateTime(i.submittedAt)} />
        <Fact label="Customer confirmed" value={formatDateTime(i.customerConfirmedAt)} />
        <Fact label="Finalized" value={formatDateTime(i.finalizedAt)} />
      </dl>
      {i.damageNotes ? (
        <p className="whitespace-pre-line rounded-[var(--radius-sm)] border border-border bg-muted/40 p-3 text-sm text-foreground">
          {i.damageNotes}
        </p>
      ) : null}
      {i.customerAbsentReason ? (
        <p className="text-sm text-muted-foreground">
          Customer absent: {i.customerAbsentReason}
        </p>
      ) : null}
      {i.customerDisputeNote ? (
        <p className="rounded-[var(--radius-sm)] border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span className="font-medium">Customer dispute:</span>{" "}
          {i.customerDisputeNote}
        </p>
      ) : null}
      <InspectionMediaGrid media={i.media} highlightIds={highlightIds} />
    </section>
  );
}

function Fact({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn(alert ? "font-medium text-red-700" : "text-foreground")}>
        {value}
      </dd>
    </div>
  );
}
