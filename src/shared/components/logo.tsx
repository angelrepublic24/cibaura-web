import Image from "next/image";

/**
 * Cibaura brand mark. Assets live in /public/brand (extracted from the brand
 * sheet). Three variants:
 *
 *  - "lockup" (default): the navy isotype tile + the wordmark. Use `onDark`
 *    to flip the wordmark cream (dark surfaces) vs navy (light surfaces).
 *    The tile carries its own navy background, so it reads on ANY surface.
 *  - "mark": just the isotype tile (compact / square slots).
 *  - "full": the full colour lockup (isotype + wordmark + tagline). Built for
 *    DARK surfaces only (its strokes are the brand's cream/copper on navy).
 *
 * Assets are `unoptimized` (small, pre-sized PNGs with baked transparency) so
 * they render identically in `next dev` and a static export.
 */
type LogoVariant = "lockup" | "mark" | "full";

export function Logo({
  variant = "lockup",
  onDark = false,
  className,
  priority = false,
}: {
  variant?: LogoVariant;
  onDark?: boolean;
  className?: string;
  priority?: boolean;
}) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/app-icon.png"
        alt="Cibaura"
        width={512}
        height={512}
        priority={priority}
        unoptimized
        className={className ?? "h-8 w-8 rounded-[var(--radius-sm)]"}
      />
    );
  }

  if (variant === "full") {
    return (
      <Image
        src="/brand/logo-full.png"
        alt="Cibaura — mobility, reservations, rental marketplace"
        width={986}
        height={543}
        priority={priority}
        unoptimized
        className={className ?? "h-auto w-56"}
      />
    );
  }

  // lockup
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Image
        src="/brand/app-icon.png"
        alt=""
        aria-hidden
        width={512}
        height={512}
        priority={priority}
        unoptimized
        className="h-8 w-8 shrink-0 rounded-[var(--radius-sm)]"
      />
      <Image
        src={onDark ? "/brand/wordmark.png" : "/brand/wordmark-dark.png"}
        alt="Cibaura"
        width={982}
        height={128}
        priority={priority}
        unoptimized
        className="h-[18px] w-auto"
      />
    </span>
  );
}
