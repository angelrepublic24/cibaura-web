"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/features/auth/hooks";
import { roleHome } from "@/features/auth/role-home";
import { useAuthStore } from "@/shared/auth/store";
import { LoadingState } from "@/shared/components/states";

/**
 * Wraps the public auth screens (login / register). A visitor who already
 * holds a session has no business on a sign-in / sign-up form — showing it
 * would let them re-submit credentials while authenticated — so bounce them
 * to their role-appropriate home instead. Guests, and visitors whose session
 * has expired, fall through to the form.
 *
 * The form is held back only while an EXISTING session is being confirmed, so
 * a logged-in visitor never flashes the form before the redirect; a guest
 * (no prior session) hydrates straight to "guest" and sees the form with no
 * loading step.
 */
export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = useMe(); // hydrate the session store from the cookie, if any
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(roleHome(user));
    }
  }, [status, user, router]);

  if (status === "authenticated") {
    return <LoadingState label="Redirecting…" />;
  }
  if (status === "unknown" && me.isLoading) {
    return <LoadingState label="Checking session…" />;
  }

  return <>{children}</>;
}
