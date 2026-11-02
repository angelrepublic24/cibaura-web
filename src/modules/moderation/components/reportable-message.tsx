"use client";

import { useEffect, useRef } from "react";

/** How long the press must be held before it counts as "report this". */
const LONG_PRESS_MS = 500;
/** Moving more than this many px means the user is scrolling, not pressing. */
const MOVE_CANCEL_PX = 10;

/**
 * A chat bubble you can PRESS AND HOLD to report.
 *
 * Why a gesture and not a button: the chat has no room for a control on every
 * bubble, and this repo has no DropdownMenu primitive to hang one off. The
 * gesture is therefore paired with two things that keep it from being a
 * secret — a visible text hint in the panel, and the same action offered in
 * the booking detail for anyone who does not find or cannot perform it.
 *
 * THIS COMPONENT OWNS ONLY THE GESTURE. It reports WHICH message was held and
 * nothing else, so the thread renders ONE dialog at panel level instead of
 * one per bubble — a 50-message thread would otherwise mount 50 forms and 50
 * query observers to serve a single rare action.
 *
 * The press is cancelled by movement (so scrolling the thread never opens the
 * dialog), by lifting early, and by the pointer leaving the bubble.
 *
 * TEXT STAYS SELECTABLE on purpose: suppressing selection would make the
 * gesture more reliable on iOS but would cost every user the ability to copy
 * a message, to buy a rare action. If an incidental selection appears under
 * the dialog, opening the dialog dismisses it.
 */
export function ReportableMessage({
  onLongPress,
  disabled,
  className,
  children,
}: {
  /** Called when the hold completes. Undefined while `disabled`. */
  onLongPress: () => void;
  /**
   * True whenever a report on this bubble is a KNOWN REFUSAL, so the gesture
   * is not offered at all. Two cases, both 400/403 on arrival:
   *  - the viewer's OWN side of the thread — the backend owns a message by
   *    its sender (and, agency side, by the agency) and answers 400
   *    `MODERATION_SELF_TARGET`;
   *  - the admin observer — a platform_admin is not a party to the thread and
   *    `POST /reports` does not serve their role.
   */
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  // Kept in a ref so the unmount cleanup never fires a stale callback.
  const handlerRef = useRef(onLongPress);
  handlerRef.current = onLongPress;

  function cancel() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startRef.current = null;
  }

  // A press still in flight when the bubble unmounts (a poll replacing the
  // thread, the panel closing) must not fire into nothing.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  if (disabled) return <div className={className}>{children}</div>;

  return (
    <div
      className={className}
      onPointerDown={(e) => {
        // Primary button / single touch only.
        if (e.button !== 0) return;
        startRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          handlerRef.current();
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        const start = startRef.current;
        if (!start) return;
        if (
          Math.abs(e.clientX - start.x) > MOVE_CANCEL_PX ||
          Math.abs(e.clientY - start.y) > MOVE_CANCEL_PX
        ) {
          cancel();
        }
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
    >
      {children}
    </div>
  );
}
