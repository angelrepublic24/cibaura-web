/**
 * The shell and the section of the site's long-form text pages: Terms,
 * Privacy, Delete your account and Support.
 *
 * Both halves of this markup were written out by hand in every one of those
 * pages — the same wrapper widths, the same heading size, the same anchor
 * offset. Four copies is how two of them silently drift: a heading one step
 * bigger here, an anchor that stops clearing the header there, and nobody
 * notices because each page looks right on its own. The pages a store
 * reviewer reads are the wrong place for that.
 *
 * Plain server components with no state: these pages must keep prerendering
 * as static HTML.
 */

/** Reading-width wrapper. `/legal/*` applies it from its layout; a page outside that segment wraps itself. */
export function ContentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <article className="space-y-8">{children}</article>
    </div>
  );
}

/**
 * One numbered section, addressable by `id`.
 *
 * `scroll-mt-24` is load-bearing: the header is `sticky top-0` and `h-16`, so
 * without it a link to `#cancellation` parks the heading underneath the
 * header and the section looks like it starts mid-sentence.
 */
export function ContentSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
