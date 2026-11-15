"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/modules/auth/hooks/auth.hook";
import { roleHome, safeInternalPath } from "@/modules/auth/helpers/auth.helper";
import { useAuthStore } from "@/shared/auth/store";
import { ErrorState, LoadingState } from "@/shared/components/states";
import { getErrorMessage } from "@/shared/api/errors";

/**
 * Wraps the public auth screens (login / register). A visitor who already
 * holds a session has no business on a sign-in / sign-up form — showing it
 * would let them re-submit credentials while authenticated — so bounce them
 * to their role-appropriate home instead. Guests, and visitors whose session
 * has expired, fall through to the form.
 *
 * The server cannot read the browser's session marker. Keep the unknown
 * state identical during SSR and the first client render, then show the
 * form only after hydration has established a guest session.
 */
export function RedirectIfAuthenticated({
  children,
  next,
}: {
  children: React.ReactNode;
  next?: string;
}) {
  const me = useMe(); // hydrate the session store from the cookie, if any
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(safeInternalPath(next, roleHome(user)));
    }
  }, [status, user, router, next]);

  if (status === "authenticated") {
    return <LoadingState label="Redirecting…" />;
  }
  if (status === "unknown") {
    if (me.isError) {
      return (
        <ErrorState
          title="Could not check your session"
          message={getErrorMessage(me.error, "Please try again.")}
          onRetry={() => me.refetch()}
        />
      );
    }
    return <LoadingState label="Checking session…" />;
  }

  return <>{children}</>;
}
