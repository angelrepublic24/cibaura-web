"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff, Play } from "lucide-react";
import { mediaLabelText } from "@/features/bookings/labels";
import type { InspectionMediaDto } from "@/shared/types/domain";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Photos and videos of an inspection (ADR-0011), served through SHORT-LIVED
 * signed URLs the API embeds for the parties. Thumbnails open a viewer
 * dialog with previous/next navigation. Media whose link is missing
 * (`url === null` — not uploaded yet) or expired renders an explicit
 * placeholder instead of a broken image.
 *
 * Plain <img>/<video> on purpose: the sources are per-request signed URLs on
 * the storage origin (not allow-listed for next/image, and never cacheable).
 */
export function InspectionMediaGrid({
  media,
  emptyLabel = "No photos or videos were attached.",
  className,
}: {
  media: InspectionMediaDto[];
  emptyLabel?: string;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const items = [...media].sort((a, b) => a.position - b.position);

  if (items.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>;
  }

  return (
    <>
      <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5", className)}>
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group relative block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label={`Open ${item.kind} — ${mediaLabelText(item.label)}`}
            >
              <MediaThumb item={item} />
              <span className="absolute inset-x-0 bottom-0 truncate bg-navy/60 px-1.5 py-0.5 text-left text-[11px] text-cream">
                {mediaLabelText(item.label)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {openIndex !== null ? (
        <MediaViewerDialog
          items={items}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      ) : null}
    </>
  );
}

function MediaThumb({ item }: { item: InspectionMediaDto }) {
  const [broken, setBroken] = useState(false);

  if (!item.url || broken) {
    return (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px]">
          {item.url ? "Link expired" : "Not available"}
        </span>
      </span>
    );
  }

  if (item.kind === "video") {
    return (
      <span className="flex h-full w-full items-center justify-center">
        <video
          src={item.url}
          preload="metadata"
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
        <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-navy/70 text-cream">
          <Play className="h-4 w-4" />
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={mediaLabelText(item.label)}
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
      onError={() => setBroken(true)}
    />
  );
}

export function MediaViewerDialog({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: InspectionMediaDto[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;
  if (!item) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${mediaLabelText(item.label)} · ${item.kind === "video" ? "video" : "photo"} ${index + 1} of ${items.length}`}
      description={
        item.durationSeconds !== null ? `${item.durationSeconds}s` : undefined
      }
      className="max-w-3xl"
    >
      <div className="space-y-3">
        <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-navy">
          {!item.url ? (
            <p className="p-10 text-sm text-cream">
              This file is not available yet.
            </p>
          ) : item.kind === "video" ? (
            <video
              key={item.id}
              src={item.url}
              controls
              playsInline
              preload="metadata"
              className="max-h-[70vh] w-full"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={item.id}
              src={item.url}
              alt={mediaLabelText(item.label)}
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          )}
        </div>
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => onIndexChange(index - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => onIndexChange(index + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
