import Image from "next/image";

/**
 * Cibaura brand mark — the 2026 identity (Guía Rápida de Marca, DOBLEEMEDIA).
 *
 * The supplied artwork is a single LOCKUP: the six-armed isotype and the
 * wordmark are one piece, drawn together with their own spacing. The previous
 * assets were two files composed at render time; keeping that here would draw
 * the isotype twice. So "lockup" is one image, not a composition.
 *
 *  - "lockup" (default): isotype + wordmark. `onDark` picks the white artwork
 *    for dark surfaces; otherwise the blue-to-navy one for light surfaces.
 *  - "mark": the isotype alone, for square slots. It is blue on transparency,
 *    NOT a tile with its own background, so it needs a light surface — pass
 *    `onDark` nothing and place it accordingly.
 *
 * Sizing is deliberate rather than inherited: inside the lockup the wordmark's
 * cap height is only ~a third of the image, so a 24px lockup leaves letters
 * near 8px and the name stops being readable. 36px on desktop and 32px on
 * mobile keep it legible, which is what the brief asks for on phones.
 *
 * These PNGs carry real transparency. They are a raster trace of the PDF —
 * replace them with the vector files as soon as the studio supplies them, or
 * they will soften on high-density screens.
 */
type LogoVariant = "lockup" | "mark" | "full";

const LOCKUP_W = 1230;
const LOCKUP_H = 284;
const MARK = 272;

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
        src="/brand/isotype.png"
        alt="Cibaura"
        width={MARK}
        height={MARK}
        priority={priority}
        unoptimized
        className={className ?? "h-8 w-8"}
      />
    );
  }

  return (
    <Image
      // `wordmark.png` is NOT usable: 87% of its canvas is semi-opaque (its
      // alpha floor is 22, never 0), so on the footer's navy it composited as
      // a washed rectangle around the mark. `wordmark-light.png` is derived
      // from the cleanly-cut `wordmark-dark.png` — same artwork, only the
      // WORDMARK recoloured to `--cream`, the isotype left in brand blue.
      src={onDark ? "/brand/wordmark-light.png" : "/brand/wordmark-dark.png"}
      alt="Cibaura"
      width={LOCKUP_W}
      height={LOCKUP_H}
      priority={priority}
      unoptimized
      className={className ?? "h-8 w-auto md:h-9"}
    />
  );
}
