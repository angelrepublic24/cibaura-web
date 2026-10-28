import { CarFront } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Branded neutral placeholder for a car with NO uploaded photos. Deliberately
 * abstract — a quiet brand-tinted panel with a car glyph — so we NEVER show
 * someone else's car (the old Unsplash stock substitution is gone). Fills its
 * parent, mirroring how the real `next/image fill` renders in the same slots.
 */
export function CarPhotoPlaceholder({
  label,
  className,
}: {
  /** Optional caption, e.g. "Photos coming soon". Omit for compact slots. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label ?? "No photos yet"}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2",
        "bg-gradient-to-br from-muted via-muted/70 to-primary/10",
        className,
      )}
    >
      <CarFront
        className="h-10 w-10 text-muted-foreground/60"
        strokeWidth={1.5}
        aria-hidden
      />
      {label ? (
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
