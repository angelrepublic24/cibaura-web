import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote } from "@/shared/types/domain";
import {
  checkoutContextKey,
  freezeCheckout,
  unexpired,
  type CheckoutContext,
  type CheckoutSnapshot,
} from "../helpers/checkout-consent";

export function useCheckoutConsent(
  context: CheckoutContext,
  quote: Quote | undefined,
  refreshQuote: () => unknown,
) {
  const [accepted, setAccepted] = useState<{
    scope: string;
    version: string;
  } | null>(null);
  const [storedSnapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshGeneration = useRef(0);
  const refreshPending = useRef(false);
  const [uncertain, setUncertain] = useState<{
    userId: string;
    bookingId: string | null;
  } | null>(null);
  const scope = checkoutContextKey(context);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const currentOwner = useRef(context.userId);
  currentOwner.current = context.userId;
  const refresh = useRef(refreshQuote);
  refresh.current = refreshQuote;
  const invalidate = useCallback((message: string) => {
    setAccepted(null);
    setSnapshot(null);
    setNotice(message);
    const generation = ++refreshGeneration.current;
    refreshPending.current = true;
    setRefreshing(true);
    void Promise.resolve()
      .then(() => refresh.current())
      .catch(() => undefined)
      .finally(() => {
        if (generation === refreshGeneration.current) {
          refreshPending.current = false;
          setRefreshing(false);
        }
      });
  }, []);
  const matches = Boolean(
    accepted &&
      accepted.scope === scope &&
      accepted.version === context.legalVersion,
  );
  const snapshot = storedSnapshot?.contextKey === scope ? storedSnapshot : null;
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  const currentAcceptance = useRef(matches);
  currentAcceptance.current = matches;

  useEffect(() => {
    if (
      (storedSnapshot && storedSnapshot.contextKey !== scope) ||
      (accepted && accepted.scope !== scope)
    ) {
      invalidate(
        "The booking details or account changed. Review the current quote and terms again.",
      );
    }
  }, [scope, storedSnapshot, accepted, invalidate]);
  useEffect(() => {
    if (!snapshot) return;
    const timer = setTimeout(
      () =>
        invalidate(
          "This quote expired. Review a fresh quote and agreement before signing again.",
        ),
      Math.max(0, Date.parse(snapshot.quote.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [snapshot, invalidate]);

  function setTermsChecked(checked: boolean) {
    setAccepted(
      checked && context.legalVersion
        ? { scope, version: context.legalVersion }
        : null,
    );
    setNotice(null);
    if (!checked) setSnapshot(null);
  }
  function open() {
    if (scope !== currentScope.current || !currentAcceptance.current || refreshPending.current || uncertain?.userId === context.userId)
      return false;
    const frozen =
      quote && matches && accepted
        ? freezeCheckout(context, quote, accepted.version)
        : null;
    if (!frozen) {
      invalidate(
        "Review the current quote and accept the current terms to continue.",
      );
      return false;
    }
    setSnapshot(frozen);
    setNotice(null);
    return true;
  }
  function isCurrent(frozen: CheckoutSnapshot) {
    return (
      !refreshPending.current &&
      currentSnapshot.current === frozen &&
      currentAcceptance.current &&
      frozen.contextKey === currentScope.current &&
      unexpired(frozen.quote.expiresAt)
    );
  }
  function markUncertain(frozen: CheckoutSnapshot, bookingId: string | null) {
    setSnapshot(null);
    setAccepted(null);
    if (frozen.userId === currentOwner.current)
      setUncertain({ userId: frozen.userId, bookingId });
  }
  return {
    snapshot,
    acceptedTerms: matches,
    notice,
    refreshing,
    uncertain: uncertain?.userId === context.userId ? uncertain : null,
    setTermsChecked,
    open,
    close: () => setSnapshot(null),
    invalidate,
    isCurrent,
    markUncertain,
    isOwner: (frozen: CheckoutSnapshot) =>
      frozen.userId === currentOwner.current,
  };
}
