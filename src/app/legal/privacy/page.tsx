import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Cibaura collects, uses and protects your personal data, including KYC and driver-licence information.",
};

/**
 * /legal/privacy — Privacy Policy. Bracketed [PLACEHOLDER] values (legal
 * entity, jurisdiction, DPO contact, retention periods) must be replaced by
 * counsel before launch; the described flows mirror the real system (KYC
 * document uploads, Stripe tokenization, per-booking chat, delivery
 * addresses shared with the fulfilling agency).
 */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/** Visually distinct marker for values legal counsel must fill in. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-warning-soft px-1 font-medium text-warning">
      [{children}]
    </span>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: September 4, 2026
        </p>
      </header>

      <Section title="1. Who is responsible for your data">
        <p>
          The data controller for the Cibaura platform is{" "}
          <Placeholder>COMPANY LEGAL NAME</Placeholder>, registered in{" "}
          <Placeholder>JURISDICTION</Placeholder>, address{" "}
          <Placeholder>REGISTERED ADDRESS</Placeholder>. Privacy questions and
          data-subject requests: <Placeholder>PRIVACY CONTACT EMAIL</Placeholder>.
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

      <Section title="2. What we collect">
        <p>
          <strong className="text-foreground">Account data</strong> — name,
          email address, phone number and password (stored only as a
          cryptographic hash).
        </p>
        <p>
          <strong className="text-foreground">
            Identity verification (KYC) data
          </strong>{" "}
          — to rent a vehicle you upload photos of a government-issued ID
          (front/back) and your driver&rsquo;s licence (front/back), plus the
          licence expiry date. These images are stored in access-controlled
          storage, are used solely to verify that you can lawfully rent and
          drive, and are visible only to our verification staff and — where
          legally required — the Agency fulfilling your booking.
        </p>
        <p>
          <strong className="text-foreground">Booking data</strong> — the cars,
          dates, prices, pickup/delivery choices and, for door-to-door
          delivery, the delivery address and coordinates you provide.
        </p>
        <p>
          <strong className="text-foreground">Messages</strong> — the
          per-booking chat between you and the Agency, kept as part of the
          booking record (it also serves as the handover/damage record).
        </p>
        <p>
          <strong className="text-foreground">Payment data</strong> — your card
          is collected and tokenized directly by Stripe; Cibaura never
          receives or stores card numbers. We store only the token, card brand
          and last four digits, and the transaction history of your bookings.
        </p>
        <p>
          <strong className="text-foreground">Technical data</strong> — device
          and log information (IP address, browser, timestamps) used for
          security, fraud prevention and debugging.
        </p>
      </Section>

      <Section title="3. Why we process it">
        <p>
          We process personal data to: operate your account and bookings
          (contract performance); verify identity and licence validity before a
          rental (legal/contractual requirement and fraud prevention); process
          payments and payouts through Stripe; enable renter–agency
          communication; keep the marketplace safe (fraud, abuse and
          circumvention detection); comply with legal obligations (tax,
          accounting, sanctions); and send transactional notifications about
          your bookings. Marketing communications, if any, are sent only with
          your consent and can be opted out of at any time.
        </p>
      </Section>

      <Section title="4. Who we share it with">
        <p>
          <strong className="text-foreground">Agencies</strong> — the Agency
          fulfilling your booking sees your name, the booking details, the
          chat, and (for delivery bookings) your delivery address. Agencies may
          verify your licence at handover.
        </p>
        <p>
          <strong className="text-foreground">Stripe</strong> — payment
          processing, subject to Stripe&rsquo;s privacy policy.
        </p>
        <p>
          <strong className="text-foreground">Service providers</strong> —
          hosting, file storage, email delivery and error monitoring providers
          acting under contract as processors (
          <Placeholder>LIST PRINCIPAL SUBPROCESSORS</Placeholder>).
        </p>
        <p>
          <strong className="text-foreground">Authorities</strong> — where
          required by law, court order or to protect safety and prevent fraud.
          We do not sell personal data.
        </p>
      </Section>

      <Section title="5. Retention">
        <p>
          Account and booking records are kept while your account is active and
          thereafter as required for legal, tax and dispute purposes (
          <Placeholder>RETENTION PERIOD, e.g. X years</Placeholder>). KYC
          document images are retained{" "}
          <Placeholder>KYC RETENTION PERIOD</Placeholder> after verification or
          account closure, then deleted. Chat messages live and die with the
          booking record.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          Data in transit is encrypted (TLS); identity documents are stored in
          access-controlled storage; passwords are hashed; card data never
          reaches our servers. Access to KYC material is restricted to
          authorized verification staff and is logged. No system is perfectly
          secure — if a breach affects you, we will notify you and the relevant
          authority as required by law.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>
          Subject to the law of <Placeholder>JURISDICTION</Placeholder>, you
          may request access to, correction of, or deletion of your personal
          data; object to or restrict certain processing; and receive a
          portable copy. You can update your name and phone in your profile at
          any time. To exercise other rights, contact{" "}
          <Placeholder>PRIVACY CONTACT EMAIL</Placeholder> — we may need to
          verify your identity first, and some data (e.g. records of completed
          rentals) must be retained where the law requires it.
        </p>
      </Section>

      <Section title="8. Cookies and local storage">
        <p>
          Cibaura uses strictly necessary cookies and browser storage to keep
          you signed in (session/refresh tokens) and to remember interface
          preferences. We do not use third-party advertising cookies. Stripe
          may set its own cookies when the payment form loads, for fraud
          prevention. Blocking essential cookies will prevent sign-in from
          working.
        </p>
      </Section>

      <Section title="9. Children">
        <p>
          The Platform is not directed at children. You must be at least 18 to
          hold an account, and we do not knowingly collect data from minors —
          if we learn we have, we delete it.
        </p>
      </Section>

      <Section title="10. Changes to this policy">
        <p>
          We may update this policy; material changes will be announced on the
          Platform before they take effect. The date at the top reflects the
          latest revision.
        </p>
      </Section>
    </>
  );
}
