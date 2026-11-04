import { ContentShell } from "@/shared/components/content-section";

/**
 * /legal — shared typographic shell for the legal pages (Terms, Privacy).
 * Static server-rendered content; each page brings its own headings.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ContentShell>{children}</ContentShell>;
}
