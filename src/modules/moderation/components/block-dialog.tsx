"use client";

import { useEffect } from "react";
import Link from "next/link";

import { useBlockSubject } from "@/modules/moderation/hooks/moderation.hook";
import type { BlockSubjectType } from "@/modules/moderation/types/moderation.types";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { Dialog } from "@/shared/components/ui/dialog";

/** Copy for the block-time backend codes (`moderation-codes.ts`). */
function describeModerationError(error: unknown): string {
  switch (getApiErrorCode(error)) {
    case API_ERROR_CODES.MODERATION_SELF_TARGET:
      return "You cannot block your own account or your own agency.";
    case API_ERROR_CODES.MODERATION_BLOCK_OWNER_ONLY:
      return "Only the agency owner can block a person. Report them instead — that reaches our team, who can act on the account.";
    default:
      return getErrorMessage(error, "Could not block right now.");
  }
}
// BLOCK_EXISTS is absent on purpose: `useBlockSubject` treats an existing
// block as success, because the user's intent is already satisfied.

/**
 * Block an agency or a person.
 *
 * COPY RULE THIS SCREEN OBEYS — it promises EXACTLY what the backend does,
 * which is two things and not three:
 *
 *  1. An agency's cars leave this viewer's `GET /cars/search` and
 *     `/cars/catalog` — items and facets both.
 *  2. `POST /bookings` answers 403 `MODERATION_BLOCKED` in EITHER direction.
 *
 * What it must therefore NOT say: that the agency disappears everywhere. A
 * storefront or car page reached by a direct link still renders (a
 * deliberate backend decision — a destination someone asked for by slug is
 * not the recommendation flow), and a favourite stays in the saved list. So
 * the wording is "will not appear in your search results", never "you will
 * never see them again".
 *
 * And it must not say the other side finds out, because they never do: there
 * is no notification, and the booking refusal names nobody.
 */
export function BlockDialog({
  open,
  onClose,
  subjectType,
  subjectId,
  subjectName,
}: {
  open: boolean;
  onClose: () => void;
  subjectType: BlockSubjectType;
  subjectId: string;
  /** Who is being blocked, for the copy. */
  subjectName: string;
}) {
  const mutation = useBlockSubject();

  const { reset: resetMutation } = mutation;
  useEffect(() => {
    if (open) resetMutation();
  }, [open, resetMutation]);

  const busy = mutation.isPending;
  const blocked = mutation.isSuccess;
  const isAgency = subjectType === "agency";

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={blocked ? `${subjectName} is blocked` : `Block ${subjectName}?`}
      description={
        blocked ? undefined : "They are not told, and you can undo it later."
      }
    >
      {blocked ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Done. You can undo this whenever you want from{" "}
            <Link
              href="/account/blocked"
              className="text-primary underline underline-offset-2"
            >
              your blocked list
            </Link>
            .
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {isAgency ? (
              <li className="flex gap-2">
                <span aria-hidden>·</span>
                <span>
                  Their cars stop appearing in your search results and filters.
                </span>
              </li>
            ) : null}
            <li className="flex gap-2">
              <span aria-hidden>·</span>
              <span>
                Neither of you can start a new booking with the other.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden>·</span>
              <span>
                {subjectName} is <span className="font-medium">not</span> told
                about this.
              </span>
            </li>
          </ul>

          {/*
            Said plainly because the alternative is someone blocking a host
            mid-rental expecting the rental to stop. It does not: the block
            gates NEW bookings only.
          */}
          <p className="rounded-[var(--radius-sm)] border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Bookings already under way are not affected — they run to the end,
            chat included. This does not cancel anything and does not refund
            anything.
          </p>

          {mutation.error ? (
            <p className="text-sm text-destructive" role="alert">
              {describeModerationError(mutation.error)}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              Not now
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => mutation.mutate({ subjectType, subjectId })}
            >
              {busy ? "Blocking…" : `Block ${isAgency ? "agency" : "person"}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
