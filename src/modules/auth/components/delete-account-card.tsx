"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import {
  agencyClosureBlockers,
  describeAgencyClosureBlocker,
} from "@/modules/auth/helpers/auth.helper";
import { useDeleteAccount } from "@/modules/auth/hooks/auth.hook";
import { deleteAccountSchema } from "@/modules/auth/schema/auth.schema";
import type { DeleteAccountFormValues } from "@/modules/auth/types/auth.types";
import {
  API_ERROR_CODES,
  getApiErrorCode,
  getErrorMessage,
} from "@/shared/api/errors";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Dialog } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * "Delete account" danger card + password-confirmation modal
 * (`DELETE /users/me`). The backend refuses while the user still has open
 * bookings, or while an agency they OWN still has live business; both 409s are
 * explained with a way out instead of a bare error, and the agency one is
 * itemised obligation by obligation ({@link AgencyStillLive}). An owner with
 * nothing open is deleted and their agency closed in the same transaction. On
 * success the hook signs out and goes home.
 */
export function DeleteAccountCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useDeleteAccount();

  const form = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: "" },
  });

  function close() {
    if (mutation.isPending) return;
    setOpen(false);
    form.reset();
    mutation.reset();
  }

  return (
    <Card className={cn("max-w-lg border-red-200", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="h-4 w-4" />
          Delete account
        </CardTitle>
        <CardDescription>
          Permanently closes your account: your profile is anonymized, your
          identity documents and saved cards are deleted, and you are signed
          out everywhere. Completed booking and payment records are kept for
          the legal retention period described in our Privacy Policy. If you
          own an agency, this closes the agency too — its listings come down
          and it stops taking bookings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setOpen(true)}
        >
          Delete my account
        </Button>
      </CardContent>

      <Dialog
        open={open}
        onClose={close}
        title="Delete your account?"
        description="This cannot be undone. Enter your password to confirm."
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            mutation.mutate(values.password),
          )}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Password</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <DeleteAccountError error={mutation.error} />
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={mutation.isPending}
            >
              Keep my account
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function DeleteAccountError({ error }: { error: unknown }) {
  const code = getApiErrorCode(error);

  if (code === API_ERROR_CODES.ACCOUNT_HAS_ACTIVE_BOOKINGS) {
    return (
      <div
        className="space-y-1 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        role="alert"
      >
        <p className="font-medium">You still have open bookings.</p>
        <p>
          Accounts with a requested, accepted or active booking cannot be
          deleted. Cancel or complete them first, then come back.{" "}
          <Link href="/account" className="underline underline-offset-2">
            View my bookings
          </Link>
        </p>
      </div>
    );
  }

  if (code === API_ERROR_CODES.ACCOUNT_OWNS_AGENCY) {
    return <AgencyStillLive error={error} />;
  }

  if (code === API_ERROR_CODES.PASSWORD_INCORRECT) {
    return (
      <p className="text-sm text-destructive" role="alert">
        That password is not correct.
      </p>
    );
  }

  return (
    <p className="text-sm text-destructive" role="alert">
      {getErrorMessage(error, "Could not delete your account. Please try again.")}
    </p>
  );
}

/**
 * The itemised refusal for an agency OWNER: one row per obligation that still
 * binds the business, with the server's own numbers and a link to the
 * dashboard page that clears it.
 *
 * This replaced "Contact support to close the agency first" — which was both a
 * dead end (no such request existed) and, on the app side, the exact pattern
 * App Store guideline 5.1.1(v) forbids. Deleting the account now closes the
 * agency in the same transaction; it refuses only while the agency owes
 * somebody a car or money, and then it says which.
 */
function AgencyStillLive({ error }: { error: unknown }) {
  const blockers = agencyClosureBlockers(error);

  return (
    <div
      className="space-y-2 rounded-[var(--radius-sm)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
      role="alert"
    >
      <p className="font-medium">
        Your agency still has live business, so this account cannot go yet.
      </p>
      {blockers.length === 0 ? (
        <p>
          {getErrorMessage(
            error,
            "Finish what is still open in the agency dashboard, then come back.",
          )}
        </p>
      ) : (
        <ul className="space-y-2">
          {blockers.map((blocker) => {
            const { title, body, href, linkLabel } =
              describeAgencyClosureBlocker(blocker);
            return (
              <li key={blocker.code} className="space-y-0.5">
                <p className="font-medium">{title}</p>
                {body ? <p>{body}</p> : null}
                {href && linkLabel ? (
                  <Link
                    href={href}
                    className="inline-block font-medium underline underline-offset-2"
                  >
                    {linkLabel}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <p>
        Deleting this account closes the agency with it, so there is nothing
        else to ask us for — come back once the list above is clear.
      </p>
    </div>
  );
}
