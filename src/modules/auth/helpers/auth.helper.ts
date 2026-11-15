import { getApiErrorBody } from "@/shared/api/errors";
import { formatIsoDate } from "@/shared/utils/dates";
import { formatMoneyCents } from "@/shared/utils/money";
import type { User } from "@/shared/types/domain";
import { accountDeletionBlockersSchema } from "@/modules/auth/schema/auth.schema";
import type {
  AgencyClosureBlocker,
  AuthUserWire,
} from "@/modules/auth/types/auth.types";

/**
 * Pure auth helpers (mappers, routing, guards). No API or service calls here.
 */

/**
 * Map the backend user (`name`) onto the web `User` (`fullName`). The wire
 * carries `name` in both directions; the type fork stays local to the client.
 * Nullable wire fields collapse to the web shape (`phone`/`agencyId` →
 * `undefined`, `termsVersion` → `null`, missing `createdAt` → `""`).
 */
export function toUser(u: AuthUserWire): User {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone ?? undefined,
    fullName: u.name,
    roles: u.roles,
    agencyId: u.agencyId ?? undefined,
    status: u.status,
    termsVersion: u.termsVersion ?? null,
    createdAt: u.createdAt ?? "",
  };
}

/**
 * The home surface for a signed-in user: agency owners/staff land in the
 * agency workspace, platform admins in the admin console, everyone else in
 * the public marketplace. Shared by the login flow and the
 * redirect-if-authenticated guard on the public auth screens so the routing
 * lives in exactly one place.
 */
export function roleHome(user: User): string {
  if (
    user.roles.includes("agency_owner") ||
    user.roles.includes("agency_staff")
  ) {
    return "/agency";
  }
  if (user.roles.includes("platform_admin")) {
    return "/admin";
  }
  return "/";
}

/**
 * A post-auth redirect target that is safe to follow. Only a SAME-ORIGIN
 * internal path passes; protocol-relative (`//evil.com`) and backslash
 * (`/\evil.com`, which browsers normalise to `//`) forms are rejected so a
 * crafted `?next=` can never open-redirect off-site after login/register.
 * Parse with the browser's URL rules too: embedded tabs/newlines are removed
 * during normalization, so `/\n/evil.com` becomes an external URL even though
 * its first two characters pass the path check. Anything unsafe (or absent)
 * falls back to the caller's `fallback`.
 */
export function safeInternalPath(
  next: string | undefined,
  fallback: string,
): string {
  if (!next || !/^\/(?![/\\])/.test(next)) return fallback;
  const internalOrigin = "https://cibaura.invalid";
  try {
    return new URL(next, internalOrigin).origin === internalOrigin
      ? next
      : fallback;
  } catch {
    return fallback;
  }
}

// ------------------------------------- agency-closure obligations (409 body)

/**
 * Stable codes for the obligations that refuse the closure of an agency —
 * and therefore the deletion of its owner's account (backend
 * `agencies/closure/agency-closure.ts`). One per dashboard screen a host can
 * go and do something about, which is the point: the refusal is a to-do list.
 */
export const AGENCY_CLOSURE_BLOCKER_CODES = {
  OPEN_BOOKINGS: "AGENCY_OPEN_BOOKINGS",
  OPEN_CLAIMS: "AGENCY_OPEN_CLAIMS",
  WALLET_BALANCE: "AGENCY_WALLET_BALANCE",
  PENDING_PAYOUTS: "AGENCY_PENDING_PAYOUTS",
  HELD_DEPOSITS: "AGENCY_HELD_DEPOSITS",
  OPEN_DISPUTE: "AGENCY_OPEN_DISPUTE",
} as const;

/** One obligation as the delete-account card renders it. */
export interface AgencyClosureBlockerCopy {
  title: string;
  body: string;
  /** The dashboard page that clears it, or null when only the platform can. */
  href: string | null;
  linkLabel: string | null;
}

/**
 * The obligations the backend listed on an `ACCOUNT_OWNS_AGENCY` refusal, in
 * the order it sent them (most actionable first). Anything else — a different
 * error, no body, a body without the field — is an empty list, so a caller can
 * ask unconditionally.
 */
export function agencyClosureBlockers(
  error: unknown,
): AgencyClosureBlocker[] {
  return accountDeletionBlockersSchema.parse(getApiErrorBody(error)).blockers;
}

/**
 * One obligation as a sentence a host can act on, with the numbers the server
 * sent. An UNKNOWN code falls back to the server's own `message` and offers no
 * link: a build that predates an obligation must still show what the server
 * said rather than swallow a row it cannot label.
 */
export function describeAgencyClosureBlocker(
  blocker: AgencyClosureBlocker,
): AgencyClosureBlockerCopy {
  const money =
    blocker.amountCents === undefined
      ? null
      : formatMoneyCents(blocker.amountCents, blocker.currency);
  const n = blocker.count ?? 0;

  switch (blocker.code) {
    case AGENCY_CLOSURE_BLOCKER_CODES.OPEN_BOOKINGS:
      return {
        title: `${n} ${n === 1 ? "booking" : "bookings"} still open`,
        body: blocker.clearsOn
          ? `Finish or cancel them first — the last one ends ${formatIsoDate(blocker.clearsOn)}. A booking counts until it is settled, so one you have already taken back still needs closing out.`
          : "Finish or cancel them first. A booking counts until it is settled, so one you have already taken back still needs closing out.",
        href: "/agency/requests",
        linkLabel: "Open requests",
      };
    case AGENCY_CLOSURE_BLOCKER_CODES.OPEN_CLAIMS:
      return {
        title: `${n} damage ${n === 1 ? "claim" : "claims"} unresolved`,
        body: "A claim has to be decided before the agency can close — the renter is waiting on an answer, or on money.",
        href: "/agency/requests",
        linkLabel: "Open requests",
      };
    case AGENCY_CLOSURE_BLOCKER_CODES.WALLET_BALANCE:
      return {
        title: `${money ?? "Money"} left in your wallet`,
        body: "Withdraw it before you delete the account — closing the agency does not pay it out. Part of it may still be held until the rentals it came from are settled.",
        href: "/agency/wallet",
        linkLabel: "Open wallet",
      };
    case AGENCY_CLOSURE_BLOCKER_CODES.PENDING_PAYOUTS:
      return {
        title: `${n} ${n === 1 ? "payout" : "payouts"} on the way${money ? ` (${money})` : ""}`,
        body: "Wait until it lands in your bank account. We cannot close the agency while money is in transit to it.",
        href: "/agency/wallet",
        linkLabel: "Open wallet",
      };
    case AGENCY_CLOSURE_BLOCKER_CODES.HELD_DEPOSITS:
      return {
        title: `${n} security ${n === 1 ? "deposit" : "deposits"} still held`,
        body: "These are real holds on your renters' cards. They are released when each rental is checked in and settled.",
        href: "/agency/requests",
        linkLabel: "Open requests",
      };
    case AGENCY_CLOSURE_BLOCKER_CODES.OPEN_DISPUTE:
      return {
        title: "A card dispute is open",
        body: "A renter's bank is disputing a payment. It is settled between their bank and Cibaura, so there is nothing for you to do: the agency can close once the bank decides, usually within a few weeks.",
        href: null,
        linkLabel: null,
      };
    default:
      return {
        title: blocker.message,
        body: "",
        href: null,
        linkLabel: null,
      };
  }
}
