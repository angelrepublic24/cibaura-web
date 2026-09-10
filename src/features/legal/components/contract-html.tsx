import { cn } from "@/lib/utils";

/**
 * Readable styling for a SERVER-RENDERED contract (ADR-0010): Markdown →
 * sanitized HTML with variables substituted and HTML-escaped on the
 * backend, so the client shows it verbatim. Shared by the public rental
 * agreement on the car page, the sign step of the request flow and the
 * host-agreement screens.
 */
const CONTRACT_HTML_CLASS =
  "overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-muted/40 p-5 text-sm leading-relaxed text-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-medium [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_hr]:my-4 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left";

export function ContractHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={cn(CONTRACT_HTML_CLASS, "max-h-[28rem]", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
