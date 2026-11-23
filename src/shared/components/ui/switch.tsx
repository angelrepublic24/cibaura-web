"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * An on/off control that LOOKS like a switch and IS a checkbox.
 *
 * The element stays `<input type="checkbox">` on purpose. Every consumer here
 * registers it with react-hook-form (`{...form.register(name)}`), which reads
 * and writes `checked` on a real checkbox — a `<button role="switch">` would
 * have meant a `Controller` and a second source of truth for each flag. The
 * input is visually hidden but still the thing that receives focus, keyboard
 * and the form value; the track and knob are drawn from its `peer` state, so
 * they cannot drift from what the form holds.
 *
 * `sr-only` rather than `hidden` or `opacity-0 w-0`: it has to stay focusable
 * and hit-testable for the label that wraps it.
 *
 * ── THE WRAPPER IS A `<label>`, AND THAT IS THE WHOLE POINT ───────────────
 *
 * It shipped as a `<span>`. The input was `sr-only` and the 44x24 track was an
 * `aria-hidden` SIBLING with nothing associating the two, so clicking the
 * track did nothing at all — the only way to flip the switch was to click the
 * setting's name, half a row away, or to reach it with Tab and press Space.
 * The track even carried `cursor-pointer`, so the pointer promised something
 * the element could not do.
 *
 * On `/admin/settings` that meant the two platform flags — "require a
 * finalized inspection" and "pay hosts through Stripe" — looked dead, or
 * worse, looked flipped when they were not. A `<label>` containing the input
 * makes the entire control clickable with no id plumbing at all.
 */
const Switch = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(function Switch({ className, ...props }, ref) {
  return (
    <label
      className={cn(
        "relative inline-flex shrink-0",
        props.disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        aria-hidden
        className={cn(
          "h-6 w-11 rounded-full border border-border-strong bg-muted transition-colors",
          "peer-checked:border-success peer-checked:bg-success",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40",
          "peer-disabled:opacity-50",
        )}
      />
      {/* The knob. `left` is animated rather than a transform so it keeps its
          round shape while the track border changes colour underneath. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-[left]",
          "peer-checked:left-[1.375rem]",
        )}
      />
    </label>
  );
});

export { Switch };
