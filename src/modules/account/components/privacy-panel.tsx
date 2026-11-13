"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  authKeys,
  useExportMyData,
  useMe,
  useUpdateMe,
} from "@/modules/auth/hooks/auth.hook";
import { DeleteAccountCard } from "@/modules/auth/components/delete-account-card";
import { useMyBookings } from "@/modules/bookings/hooks/bookings.hook";
import { BlockedSubjectsPanel } from "@/modules/moderation/components/blocked-subjects-panel";
import { useHasModerationRole } from "@/modules/moderation/hooks/use-moderation-gate.hook";
import { useAuthStore } from "@/shared/auth/store";
import { getErrorMessage } from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import { ErrorState, LoadingState } from "@/shared/components/states";
import type { User } from "@/shared/types/domain";
import { SettingsPageTitle } from "./settings-section";

function MarketingPreference({ user }: { user: User }) {
  const [draft, setDraft] = useState<boolean | null>(null);
  const optIn = draft ?? user.marketingOptIn === true;
  const mutation = useUpdateMe();
  const qc = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  return (
    <section className="settings-surface">
      <div className="settings-surface-head">
        <h3>Communication preferences</h3>
        <p>Choose optional updates. Important account notices stay enabled.</p>
      </div>
      <div className="settings-surface-body">
        <div className="settings-reference-row">
          <div>
            <h4>Rental &amp; security updates</h4>
            <p>
              Reservation changes, verification requests and important account
              notices.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Essential</span>
        </div>
        <div className="settings-reference-row">
          <div>
            <h4>Offers &amp; news</h4>
            <p>Optional marketing updates from Cibaura.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={optIn}
              onChange={(event) => setDraft(event.target.checked)}
              disabled={mutation.isPending}
            />
            Receive offers and news
          </label>
        </div>
        {mutation.isError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {getErrorMessage(mutation.error, "Could not save your preference.")}
          </p>
        )}
        {mutation.isSuccess && optIn === user.marketingOptIn && (
          <p role="status" className="mt-3 text-sm text-success">
            Preference saved.
          </p>
        )}
      </div>
      <div className="settings-action-bar">
        <p>You can change this preference at any time.</p>
        <Button
          type="button"
          disabled={mutation.isPending || optIn === user.marketingOptIn}
          onClick={() =>
            mutation.mutate(
              { marketingOptIn: optIn },
              {
                onSuccess: (updated) => {
                  setDraft(null);
                  setUser(updated);
                  qc.setQueryData(authKeys.me(), updated);
                },
              },
            )
          }
        >
          {mutation.isPending ? "Saving…" : "Save preference"}
        </Button>
      </div>
    </section>
  );
}

function DataDownload() {
  const exportData = useExportMyData();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="settings-reference-row">
      <div>
        <h4>Get a copy of your data</h4>
        <p>
          Download your profile, verification and file metadata, own
          rental/payment history, saved-card display details, reviews, sent
          messages, favorites, blocks, reports and notifications.
        </p>
        <p>
          File contents, private links, secrets, gateway references and other
          people&apos;s identity details are excluded.
        </p>
        {exportData.isError && (
          <p role="alert" className="text-destructive">
            {getErrorMessage(
              exportData.error,
              "Could not download your data. Please try again.",
            )}
          </p>
        )}
        {url && (
          <a
            className="mt-2 inline-block text-primary underline"
            href={url}
            download="cibaura-my-data.json"
          >
            Download ready — save JSON file
          </a>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={exportData.isPending}
        onClick={() =>
          exportData.mutate(undefined, {
            onSuccess: (blob) => {
              const next = URL.createObjectURL(blob);
              setUrl(next);
              const link = document.createElement("a");
              link.href = next;
              link.download = "cibaura-my-data.json";
              document.body.append(link);
              link.click();
              link.remove();
            },
          })
        }
      >
        {exportData.isPending ? "Downloading…" : "Download my data"}
      </Button>
    </div>
  );
}

function ClosureReview() {
  const bookings = useMyBookings();
  if (bookings.isError)
    return (
      <ErrorState
        title="Could not review open rentals"
        message={getErrorMessage(bookings.error, "Please try again.")}
        onRetry={() => bookings.refetch()}
      />
    );
  if (!bookings.data) return <LoadingState label="Checking your rentals…" />;
  const active = bookings.data.filter((booking) =>
    ["requested", "accepted", "active"].includes(booking.state),
  );
  return (
    <div className="mt-5 space-y-4 border-t border-border pt-5">
      <h4 className="font-medium">Before you continue</h4>
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          Accounts with requested, accepted or active rentals cannot be deleted.
        </li>
        <li>Download any information you want to keep.</li>
        <li>
          Your profile is anonymized, saved cards and identity documents are
          deleted, and sessions are revoked. Booking/payment records remain for
          the legal retention period.
        </li>
        <li>
          Agency owners may also have business obligations checked when
          confirming deletion.
        </li>
      </ul>
      <p className="text-sm">
        Closing your account does not cancel an active rental.
      </p>
      {active.length > 0 ? (
        <div className="rounded-lg border border-border p-4">
          <p className="font-medium">
            You have {active.length} open rental{active.length === 1 ? "" : "s"}
            .
          </p>
          <ul className="mt-3 space-y-2">
            {active.map((booking) => (
              <li key={booking.id}>
                <Link
                  className="text-sm text-primary underline"
                  href={`/account/bookings/${booking.id}`}
                >
                  {booking.car.make} {booking.car.model} · {booking.state}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Finish or cancel these rentals before closing your account.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            No requested, accepted or active rentals were found. The server
            checks your eligibility again when you confirm.
          </p>
          <DeleteAccountCard className="w-full max-w-none" />
        </>
      )}
    </div>
  );
}

export function PrivacyPanel({
  initialClosure = false,
  initialBlocks = false,
}: {
  initialClosure?: boolean;
  initialBlocks?: boolean;
}) {
  const profile = useMe();
  const canHaveBlocks = useHasModerationRole();
  const [showBlocks, setShowBlocks] = useState(initialBlocks);
  const [showClosure, setShowClosure] = useState(initialClosure);
  if (profile.isError)
    return (
      <ErrorState
        title="Could not load privacy settings"
        message={getErrorMessage(profile.error, "Please try again.")}
        onRetry={() => profile.refetch()}
      />
    );
  if (!profile.data) return <LoadingState label="Loading privacy settings…" />;
  return (
    <div>
      <SettingsPageTitle
        title="Privacy & account"
        description="Your preferences, information and account controls."
      />
      <MarketingPreference key={profile.data.id} user={profile.data} />
      <section className="settings-surface">
        <div className="settings-surface-head">
          <h3>Your information</h3>
          <p>See how your information is used and download your own data.</p>
        </div>
        <div className="settings-surface-body">
          <DataDownload />
          <details className="py-4">
            <summary className="cursor-pointer text-sm font-medium">
              Data use &amp; privacy
            </summary>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-medium">Profile &amp; contact</dt>
                <dd className="text-muted-foreground">
                  Account access, rental agreements and booking communication.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Identity documents</dt>
                <dd className="text-muted-foreground">
                  Private review by authorized reviewers. Additional requests
                  include their own reason and status.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Payments</dt>
                <dd className="text-muted-foreground">
                  Saved-card references and transaction history. Card entry
                  stays with the payment provider.
                </dd>
              </div>
            </dl>
            <Link
              href="/legal/privacy"
              className="mt-4 inline-block text-sm text-primary underline"
            >
              Read the Privacy Policy
            </Link>
          </details>
          {(canHaveBlocks || initialBlocks) && (
            <div className="border-t border-border pt-4">
              <div className="settings-reference-row">
                <div>
                  <h4>Blocked agencies &amp; people</h4>
                  <p>Manage the blocks you have created.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  aria-expanded={showBlocks}
                  onClick={() => setShowBlocks((value) => !value)}
                >
                  {showBlocks ? "Hide blocked list" : "Manage blocks"}
                </Button>
              </div>
              {showBlocks && <BlockedSubjectsPanel />}
            </div>
          )}
        </div>
      </section>
      <section className="settings-surface">
        <div className="settings-surface-head">
          <h3>Close your account</h3>
          <p>Review what closing your account means before continuing.</p>
        </div>
        <div className="settings-surface-body">
          <div className="settings-reference-row">
            <div>
              <h4>Delete account</h4>
              <p>
                Review your current rentals and the information retained under
                the Privacy Policy.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              aria-expanded={showClosure}
              onClick={() => setShowClosure((value) => !value)}
            >
              {showClosure ? "Hide review" : "Review closure"}
            </Button>
          </div>
          {showClosure && <ClosureReview />}
        </div>
      </section>
    </div>
  );
}
