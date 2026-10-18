import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/shared/config/legal";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "Delete your account",
    description: `How to delete your ${LEGAL.companyName} account and what happens to your data, including identity documents, saved cards and rental history.`,
    path: "/legal/delete-account",
  });
}

/**
 * /legal/delete-account — the account-deletion request page the app stores
 * require.
 *
 * Google Play will not accept a listing for an app that creates accounts
 * unless deletion can be requested from a page reachable WITHOUT installing
 * the app or signing in, so this page is deliberately static, public and
 * link-free of anything behind auth.
 *
 * Everything below mirrors what the server actually does
 * (`users.service.ts` → `USER_DELETED_EVENT`), including the parts that are
 * awkward: the row is anonymised rather than dropped, rentals and payments
 * survive because they are also the counterparty's records, and an agency
 * owner cannot complete deletion alone. Declaring "users can delete from the
 * app" without those caveats is the under-declaration this page exists to
 * avoid.
 */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function DeleteAccountPage() {
  const company = LEGAL.companyName;
  const mailto = `mailto:${LEGAL.contactEmail}?subject=${encodeURIComponent(
    "Account deletion request",
  )}`;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Delete your account", path: "/legal/delete-account" },
        ]}
      />
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">
          Delete your account
        </h1>
        <p className="text-sm text-muted-foreground">
          How to delete your {company} account, and exactly what happens to
          your data when you do.
        </p>
      </header>

      <Section id="in-app" title="1. From the app (fastest)">
        <p>
          Open the {company} app and go to{" "}
          <strong className="text-foreground">
            Profile → Delete account
          </strong>
          . You will be asked to confirm with your password, and the deletion
          runs immediately — there is no waiting period and no confirmation
          email to chase.
        </p>
      </Section>

      <Section id="by-email" title="2. By email">
        <p>
          If you cannot reach the app — you have uninstalled it, lost access to
          your sign-in, or you are an agency owner (see section 5) — write to{" "}
          <a
            href={mailto}
            className="text-primary underline underline-offset-2"
          >
            {LEGAL.contactEmail}
          </a>{" "}
          from the email address on the account, with the subject{" "}
          <em>Account deletion request</em>.
        </p>
        <p>
          We answer within 30 days. We may ask you to confirm your identity
          before acting: it is the only thing standing between your account and
          somebody who merely knows your email address.
        </p>
      </Section>

      <Section id="deleted" title="3. What is deleted">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            Your identity documents and driving-licence images, erased from
            storage along with their verification record.
          </li>
          <li>
            Your saved payment cards — detached at our payment processor and
            deleted. We never held the card numbers themselves.
          </li>
          <li>Every push-notification token for your devices.</li>
          <li>
            Your name, email address and phone number, replaced with
            unidentifiable placeholders. Every active session is revoked and
            your password no longer works anywhere.
          </li>
        </ul>
      </Section>

      <Section id="kept" title="4. What is kept, and why">
        <p>
          Completed rentals, their payments and the accounting entries behind
          them are <strong className="text-foreground">not</strong> deleted.
          They are not only your records: the agency that rented you the car
          needs them for its own tax and legal obligations, and a rental
          agreement that one side can erase is not an agreement.
        </p>
        <p>
          What survives is detached from you. The records keep the booking, the
          amounts and the dates, but the person is already anonymised, so they
          can no longer be traced back to you through this platform.
        </p>
      </Section>

      <Section id="blocked" title="5. When deletion cannot run yet">
        <p>
          <strong className="text-foreground">
            You have a booking in progress.
          </strong>{" "}
          A requested, accepted or active rental has to finish or be cancelled
          first — the agency is holding a car for you. You can resolve this
          yourself from the Bookings tab, then delete the account.
        </p>
        <p>
          <strong className="text-foreground">
            You own an agency on {company}.
          </strong>{" "}
          This one you cannot resolve from the app: an agency has cars, staff
          and live bookings that belong to other people, so it has to be wound
          down before the owner&rsquo;s account can go. Write to{" "}
          <a
            href={mailto}
            className="text-primary underline underline-offset-2"
          >
            {LEGAL.contactEmail}
          </a>{" "}
          and we will handle it with you.
        </p>
      </Section>

      <Section id="more" title="6. Related">
        <p>
          Our{" "}
          <Link
            href="/legal/privacy"
            className="text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>{" "}
          explains what we collect and how long we keep it, and the{" "}
          <Link
            href="/legal/terms"
            className="text-primary underline underline-offset-2"
          >
            Terms
          </Link>{" "}
          cover the rental agreements themselves.
        </p>
      </Section>
    </>
  );
}
