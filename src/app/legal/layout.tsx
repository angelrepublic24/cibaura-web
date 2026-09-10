/**
 * /legal — shared typographic shell for the legal pages (Terms, Privacy).
 * Static server-rendered content; each page brings its own headings.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <article className="space-y-8">{children}</article>
    </div>
  );
}
