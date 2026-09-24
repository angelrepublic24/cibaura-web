import type { Metadata } from "next";
import Link from "next/link";
import { LegalVersion } from "@/features/legal/components/legal-version";
import { LEGAL } from "@/shared/config/legal";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";

export function generateMetadata(): Metadata {
  return pageMetadata({ title: "Privacy Policy", description: `How ${LEGAL.companyName} collects, uses and protects your personal data, including identity-verification and driver's license information.`, path: "/legal/privacy" });
}

/**
 * /legal/privacy — Privacy Policy. The data controller identity comes from
 * `shared/config/legal.ts` (NEXT_PUBLIC_LEGAL_*; the RNC line renders only
 * when configured). The described flows mirror the real system: KYC document
 * uploads, Stripe tokenization, per-booking chat, delivery addresses shared
 * with the fulfilling agency, the frozen rental-agreement snapshot, account
 * deletion and retention.
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

export default function PrivacyPage() {
  const company = LEGAL.companyName;

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/legal/privacy" }]} />
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">
          Privacy Policy
        </h1>
        <LegalVersion />
      </header>

      <Section id="controller" title="1. Who is responsible for your data">
        <p>
          The data controller for the Cibaura platform is{" "}
          <strong className="text-foreground">{company}</strong>
          {LEGAL.rnc ? <>, RNC {LEGAL.rnc}</> : null}, {LEGAL.address},{" "}
          {LEGAL.jurisdiction}. Privacy questions and data-subject requests:{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="text-primary underline underline-offset-2"
          >
            {LEGAL.contactEmail}
          </a>
          .
        </p>
        <p>
          This policy explains what we collect, why, who we share it with and
          the choices you have. It applies together with our{" "}
          <Link
            href="/legal/terms"
            className="text-primary underline underline-offset-2"
          >
            Terms of Service
          </Link>
          .
        </p>
      </Section>

      <Section id="data" title="2. What we collect">
        <p>
          <strong className="text-foreground">Account data</strong> — name,
          email address, phone number, password (stored only as a
          cryptographic hash), account status, and the version, time and
          network address of each acceptance of our Terms.
        </p>
        <p>
          <strong className="text-foreground">
            Identity verification (KYC) data
          </strong>{" "}
          — to rent a vehicle you provide your driver&rsquo;s license number
          and expiry date, your date of birth, and photos of a
          government-issued ID (front/back) and of your driver&rsquo;s license
          (front/back). Agencies applying to the Platform provide business
          registration and owner-identity documents. These files are stored in
          access-controlled private storage, are used solely to verify that
          you can lawfully rent and drive (or operate an agency), and are
          reviewed only by our verification staff.
        </p>
        <p>
          <strong className="text-foreground">Booking data</strong> — the
          cars, dates, prices, pickup/delivery choices and, for door-to-door
          delivery, the delivery address, reference and coordinates you
          provide. Each booking also stores a{" "}
          <strong className="text-foreground">rental agreement snapshot</strong>
          : the Terms version you accepted, your name, your license number and
          expiry as of that moment, the vehicle plate, and the Agency&rsquo;s
          rental conditions as they read that day.
        </p>
        <p>
          <strong className="text-foreground">Messages</strong> — the
          per-booking chat between you and the Agency, kept as part of the
          booking record (it also serves as the handover/damage record).
        </p>
        <p>
          <strong className="text-foreground">Payment data</strong> — your
          card is collected and tokenized directly by Stripe; {company} never
          receives or stores card numbers. We store only the gateway token,
          card brand, last four digits and expiry, plus the authorization,
          capture and refund history of your bookings. Agencies provide bank
          account details for payouts.
        </p>
        <p>
          <strong className="text-foreground">Technical data</strong> —
          device and log information (IP address, browser, timestamps,
          push-notification tokens) used for security, fraud prevention and
          debugging, and the session cookies described in Section 8.
        </p>
      </Section>

      <Section id="purposes" title="3. Why we process it">
        <p>
          We process personal data to: operate your account and bookings
          (performance of the contract); verify identity, age and license
          validity before a rental (legal and contractual requirement, fraud
          prevention); process payments, refunds and agency payouts; enable
          renter–agency communication; send transactional notifications
          (email, in-app feed, push) about your bookings, verification and
          payouts; keep the marketplace safe (fraud, abuse and circumvention
          detection); and comply with legal obligations (tax, accounting,
          sanctions). Marketing communications, if any, are sent only with
          your consent and can be opted out of at any time.
        </p>
      </Section>

      <Section id="sharing" title="4. Who we share it with">
        <p>
          <strong className="text-foreground">Agencies</strong> — the Agency
          fulfilling your booking sees your name, email and phone, the booking
          details, the rental agreement snapshot (including your masked
          license number and expiry), the chat and, for delivery bookings,
          your delivery address. Agencies never receive your identity document
          images or your date of birth; they may verify your license in
          person at handover.
        </p>
        <p>
          <strong className="text-foreground">Stripe</strong> — payment
          processing, subject to Stripe&rsquo;s privacy policy.
        </p>
        <p>
          <strong className="text-foreground">Service providers</strong> —
          hosting, database, private file storage, transactional email, push
          notification delivery, map/geocoding (only when you use door-to-door
          delivery) and error-monitoring providers acting under contract as
          processors on our behalf.
        </p>
        <p>
          <strong className="text-foreground">Authorities</strong> — where
          required by law, court order or to protect safety and prevent
          fraud. We do not sell personal data.
        </p>
      </Section>

      <Section id="retention" title="5. Retention and deletion">
        <p>
          Account data is kept while your account is active. Identity
          verification data (license details, date of birth, document images)
          is kept while you hold an account so you do not need to verify
          again for each rental, and is deleted when you delete your account.
        </p>
        <p>
          Booking records, rental agreement snapshots, messages, payment and
          payout records are retained for{" "}
          <strong className="text-foreground">ten years</strong> after the
          booking closes, the period required by Dominican tax and commercial
          law for accounting records and to handle disputes, chargebacks and
          insurance claims. Log and security data is kept for up to twelve
          months.
        </p>
        <p>
          When you delete your account (Profile → Delete account), we
          anonymize your profile (name, email and phone are replaced),
          permanently delete your identity documents and their metadata,
          detach and delete your saved cards at the gateway, remove your push
          tokens and sign out every session. Booking and payment records are
          kept for the retention period above, linked to the anonymized
          profile. Deletion is not possible while you have an open booking or
          own a pending or verified Agency.
        </p>
      </Section>

      <Section id="security" title="6. Security">
        <p>
          Data in transit is encrypted (TLS); identity documents are stored in
          private, access-controlled storage and streamed only to authorized
          reviewers; passwords are hashed; card data never reaches our
          servers; sessions use httpOnly cookies and rotating refresh tokens
          that are revoked on password change, reset, suspension and
          deletion. No system is perfectly secure: if a breach affects you,
          we will notify you and the relevant authority as required by law.
        </p>
      </Section>

      <Section id="rights" title="7. Your rights">
        <p>
          Subject to the laws of the {LEGAL.jurisdiction} (including Law
          172-13 on the protection of personal data), you may request access
          to, correction of, or deletion of your personal data; object to or
          restrict certain processing; and receive a portable copy. You can
          update your name and phone, change your password and delete your
          account from your profile at any time. To exercise other rights,
          contact{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="text-primary underline underline-offset-2"
          >
            {LEGAL.contactEmail}
          </a>
          ; we may need to verify your identity first, and some data (for
          example records of completed rentals) must be retained where the law
          requires it.
        </p>
      </Section>

      <Section id="cookies" title="8. Cookies and local storage">
        <p>
          The web platform uses strictly necessary httpOnly cookies to keep you
          signed in (an access cookie and a refresh cookie, both restricted to
          our own domain) and browser storage to remember interface
          preferences and whether a session existed. The mobile app stores
          its session tokens in the device&rsquo;s secure storage. We do not
          use third-party advertising cookies. Stripe may set its own cookies
          when the payment form loads, for fraud prevention. Blocking
          essential cookies will prevent sign-in from working.
        </p>
      </Section>

      <Section id="children" title="9. Children">
        <p>
          The Platform is not directed at children. You must be at least 18 to
          hold an account, and we do not knowingly collect data from minors;
          if we learn we have, we delete it.
        </p>
      </Section>

      <Section id="changes" title="10. Changes to this policy">
        <p>
          We may update this policy; material changes will be announced on the
          Platform before they take effect. The version shown at the top of
          this page identifies the revision currently in force.
        </p>
      </Section>
    </>
  );
}
