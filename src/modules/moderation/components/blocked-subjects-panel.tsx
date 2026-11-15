"use client";

import Link from "next/link";
import { Ban } from "lucide-react";

import {
  useMyBlocks,
  useUnblockSubject,
} from "@/modules/moderation/hooks/moderation.hook";
import { useHasModerationRole } from "@/modules/moderation/hooks/use-moderation-gate.hook";
import type {
  BlockSubjectType,
  BlockedAgency,
  BlockedPerson,
} from "@/modules/moderation/types/moderation.types";
import { getErrorMessage } from "@/shared/api/errors";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";
import { Button, buttonVariants } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { formatDateTime } from "@/shared/utils/dates";

/**
 * /account/settings/blocked — the agencies and people this user has blocked, and the
 * only place a block can be undone.
 *
 * Every dialog that creates a block points here, so this page is load-bearing
 * for the promise "you can undo it later": the backend omits a block whose
 * subject no longer exists, which means every row listed here is genuinely
 * undoable.
 *
 * The list arrives as TWO arrays and the array a row came in IS its subject
 * type for the delete call (`agencies` → `/blocks/agency/:id`, `people` →
 * `/blocks/user/:id`). That pairing is wired once, here and in the hook, and
 * never re-derived from a name or a shape guess.
 *
 * THE EMPTY STATE NAMES ONLY SURFACES THAT REALLY CARRY A BLOCK BUTTON — any
 * car page, and a booking's own detail. The agency storefront offers REPORT
 * and nothing else, so telling someone to block "from its page" would send
 * them to a flag icon that opens a report form.
 */
export function BlockedSubjectsPanel() {
  /*
   * `GET /blocks` is `@Auth(customer, agency_owner, agency_staff)`. The nav
   * row is hidden for anybody else, but a typed URL or an old bookmark still
   * lands here — so the request is never made for a viewer the endpoint would
   * refuse, and the page says why instead of painting "Could not load your
   * blocked list" over a plain 403.
   */
  const canHaveBlocks = useHasModerationRole();
  const query = useMyBlocks(canHaveBlocks);
  const unblock = useUnblockSubject();

  const agencies = query.data?.agencies ?? [];
  const people = query.data?.people ?? [];
  const nothingBlocked = agencies.length === 0 && people.length === 0;

  /** Which row is mid-flight, so only that button says "Unblocking…". */
  const pendingId = unblock.isPending ? unblock.variables?.subjectId : undefined;

  function onUnblock(subjectType: BlockSubjectType, subjectId: string) {
    unblock.mutate({ subjectType, subjectId });
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Ban className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Blocked</h2>
      </div>

      {/* The same two effects the block dialogs promise, said again here so
          this page explains what un-blocking gives back. Nothing more is
          claimed: a storefront opened by a direct link still renders. */}
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        A blocked agency&apos;s cars stay out of your search results, and new
        bookings between you and anyone blocked are refused. Nobody is told
        they have been blocked, and nothing here affects a booking already
        under way.
      </p>

      {!canHaveBlocks ? (
        <EmptyState
          title="Not available on this account"
          description="Reporting and blocking belong to renters and agency accounts. Admin accounts moderate from the reports queue instead."
          className="py-16"
        />
      ) : query.isLoading ? (
        <LoadingState label="Loading your blocked list…" className="py-16" />
      ) : query.isError ? (
        <ErrorState
          title="Could not load your blocked list"
          message={getErrorMessage(query.error, "Please try again.")}
          onRetry={() => query.refetch()}
        />
      ) : nothingBlocked ? (
        <EmptyState
          title="Nothing blocked"
          description="You can block an agency from any of its cars or from a booking you made with them, and a renter from the booking they made with you."
          className="py-16"
          action={
            <Link
              href="/agencies"
              className={buttonVariants({ variant: "outline" })}
            >
              Browse agencies
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {/* An un-block that somehow fails is reported once, here: the rows
              are optimistic, so the failed one has already come back. */}
          {unblock.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {getErrorMessage(
                unblock.error,
                "Could not unblock. Please try again.",
              )}
            </p>
          ) : null}

          {agencies.length > 0 ? (
            <section>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Agencies
              </h3>
              <div className="space-y-3">
                {agencies.map((agency) => (
                  <BlockedAgencyRow
                    key={agency.id}
                    agency={agency}
                    busy={pendingId === agency.id}
                    onUnblock={() => onUnblock("agency", agency.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {people.length > 0 ? (
            <section>
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                People
              </h3>
              <div className="space-y-3">
                {people.map((person) => (
                  <BlockedPersonRow
                    key={person.id}
                    person={person}
                    busy={pendingId === person.id}
                    onUnblock={() => onUnblock("user", person.id)}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Shell shared by both row kinds, so they cannot drift apart visually. */
function BlockedRow({
  title,
  blockedAt,
  busy,
  onUnblock,
  unblockLabel,
}: {
  title: React.ReactNode;
  blockedAt: string;
  busy: boolean;
  onUnblock: () => void;
  unblockLabel: string;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground">
          Blocked {formatDateTime(blockedAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={unblockLabel}
        onClick={onUnblock}
      >
        {busy ? "Unblocking…" : "Unblock"}
      </Button>
    </Card>
  );
}

function BlockedAgencyRow({
  agency,
  busy,
  onUnblock,
}: {
  agency: BlockedAgency;
  busy: boolean;
  onUnblock: () => void;
}) {
  return (
    <BlockedRow
      blockedAt={agency.blockedAt}
      busy={busy}
      onUnblock={onUnblock}
      unblockLabel={`Unblock ${agency.name}`}
      title={
        <Link
          href={`/agencies/${encodeURIComponent(agency.slug)}`}
          className="hover:text-primary hover:underline"
        >
          {agency.name}
        </Link>
      }
    />
  );
}

function BlockedPersonRow({
  person,
  busy,
  onUnblock,
}: {
  person: BlockedPerson;
  busy: boolean;
  onUnblock: () => void;
}) {
  // No link: a renter has no public page to send anyone to.
  return (
    <BlockedRow
      blockedAt={person.blockedAt}
      busy={busy}
      onUnblock={onUnblock}
      unblockLabel={`Unblock ${person.name}`}
      title={person.name}
    />
  );
}
