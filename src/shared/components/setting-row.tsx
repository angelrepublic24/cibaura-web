import { cn } from "@/lib/utils";

/**
 * THE SETTINGS IDIOM: one setting per row, explained on the left, controlled
 * on the right.
 *
 * ── WHY NOT A GRID OF LABELLED BOXES ─────────────────────────────────────
 *
 * The platform console used to draw twenty-four settings as a three-column
 * grid of `Label` + `Input` + hint. That shape has two problems. The label has
 * to carry the whole meaning in three words — "Advance at acceptance (%)" —
 * so the sentence that says what the number actually DOES ends up as a hint
 * nobody reads, or nowhere at all. And the values land wherever the grid puts
 * them, so you cannot run your eye down a column of numbers.
 *
 * A row fixes both: the name and its consequence sit together as prose, and
 * every control lands on the same right edge, which turns twenty-four
 * scattered boxes into one scannable column.
 *
 * ── WHAT A ROW DOES NOT DO ───────────────────────────────────────────────
 *
 * It does not own the control. The caller passes whatever the setting needs —
 * a text input with its unit, a select, a switch, a button — because the row
 * is about placement and explanation, not about input types.
 */
export function SettingRow({
  name,
  description,
  control,
  error,
  changed,
  htmlFor,
  className,
}: {
  /** What the setting is called. Rendered as the control's label when `htmlFor` is given. */
  name: string;
  /** What changes if you change it. One or two sentences, in the admin's language. */
  description?: React.ReactNode;
  /** The input, select, switch or action. Right-aligned. */
  control: React.ReactNode;
  /** Validation message. Replaces nothing — it sits under the control's own column. */
  error?: string;
  /** Marks a value edited but not yet saved, so the save bar's count has a visible source. */
  changed?: boolean;
  /** Id of the control, when there is exactly one and it can own a `<label>`. */
  htmlFor?: string;
  className?: string;
}) {
  const Heading = htmlFor ? "label" : "span";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-8",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <Heading
          {...(htmlFor ? { htmlFor } : {})}
          className={cn(
            "flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground",
            htmlFor && "cursor-pointer",
          )}
        >
          {name}
          {changed ? (
            <span className="rounded-full border border-primary/25 bg-accent-soft px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-primary">
              Unsaved
            </span>
          ) : null}
        </Heading>
        {description ? (
          <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {/* The control column. Fixed-ish width so every row's control lines up
          with the ones above and below it — that alignment is the whole point
          of the layout, and a control that sized itself to its content would
          break it. */}
      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:w-56 sm:items-end">
        {control}
        {error ? (
          <p role="alert" className="text-sm text-destructive sm:text-right">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A titled run of rows. The heading is the only thing separating one group
 * from the next — no card, no border, no shadow: twenty-four settings inside
 * nested boxes read as a form to fill in rather than a list to adjust.
 */
export function SettingGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-8 first:mt-0", className)}>
      <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      {description ? (
        <p className="mt-1.5 max-w-[68ch] text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
    </section>
  );
}
