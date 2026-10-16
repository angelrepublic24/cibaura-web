import { z } from "zod";
import { LEGAL } from "@/shared/config/legal";

/**
 * Where a customer reaches a human.
 *
 * There is no customer-to-platform endpoint in the API: the chat is scoped to
 * the booking's agency, claims can only be opened by the host, and the
 * admin-alert event has no HTTP surface. Email is the only channel that
 * exists, so it is the one the web points at.
 *
 * `NEXT_PUBLIC_SUPPORT_EMAIL` is optional and falls back to the legal contact
 * address, which is the only public mailbox the app already ships. That
 * fallback is a stopgap, not a destination: `legal@` is the data-controller
 * address and routing a stranded renter's refund into a legal queue is the
 * wrong shape. Point the variable at a monitored shared mailbox.
 */

/**
 * Both candidates come from `NEXT_PUBLIC_*` env, i.e. from outside the app, so
 * both are parsed rather than trusted. A typo in a deploy variable must not
 * ship a `mailto:` that goes nowhere — it falls through to the next candidate
 * and, failing everything, to the literal below, which is always valid.
 */
const LAST_RESORT = "legal@cibaura.com";

const emailSchema = z.email();

function resolveSupportEmail(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim(),
    LEGAL.contactEmail.trim(),
  ];
  for (const candidate of candidates) {
    if (candidate && emailSchema.safeParse(candidate).success) return candidate;
  }
  return LAST_RESORT;
}

/** The address shown to customers, as text and in `mailto:` links. */
export const SUPPORT_EMAIL = resolveSupportEmail();
