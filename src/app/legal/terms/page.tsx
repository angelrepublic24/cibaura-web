import type { Metadata } from "next";
import Link from "next/link";
import { LegalVersion } from "@/features/legal/components/legal-version";
import { CancellationPolicySummary } from "@/features/legal/components/cancellation-policy";
import { LEGAL } from "@/shared/config/legal";
import { pageMetadata } from "@/shared/seo/metadata";
import { BreadcrumbJsonLd } from "@/shared/seo/structured-data";

export function generateMetadata(): Metadata {
  return pageMetadata({ title: "Terms of Service", description: `The terms that govern your use of the ${LEGAL.companyName} rent-a-car marketplace.`, path: "/legal/terms" });
}

/**
 * /legal/terms — Terms of Service for the marketplace. The operational terms
 * mirror how the platform actually works (request-to-book, authorize at
 * request / capture on acceptance, the tiered cancellation policy rendered
 * from `GET /legal/current`, KYC gate, agency conditions, weekly bank-transfer
 * payouts, account deletion) and the operator identity comes from
 * `shared/config/legal.ts` (NEXT_PUBLIC_LEGAL_*). The version line is the
 * backend's `CURRENT_TERMS_VERSION`.
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

export default function TermsPage() {
  const company = LEGAL.companyName;

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: "/" }, { name: "Terms of Service", path: "/legal/terms" }]} />
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">
          Terms of Service
        </h1>
        <LegalVersion />
      </header>

      <Section id="who-we-are" title="1. Who we are">
        <p>
          The Cibaura platform (&ldquo;Cibaura&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) is a rent-a-car marketplace operated by{" "}
          <strong className="text-foreground">{company}</strong>
          {LEGAL.rnc ? <>, RNC {LEGAL.rnc}</> : null}, with registered
          address at {LEGAL.address}, {LEGAL.jurisdiction}. These Terms of
          Service (the &ldquo;Terms&rdquo;) govern your access to and use of
          the Cibaura website, applications and services (together, the
          &ldquo;Platform&rdquo;).
        </p>
        <p>
          By creating an account, requesting a booking or listing vehicles you
          agree to these Terms and to our{" "}
          <Link
            href="/legal/privacy"
            className="text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . Each acceptance is recorded with the version shown above, the
          date and time, and the network address it came from. If you do not
          agree, do not use the Platform.
        </p>
      </Section>

      <Section id="intermediary" title="2. Cibaura is an intermediary; agencies own the cars">
        <p>
          Cibaura connects customers with independent, verified rent-a-car
          agencies (&ldquo;Agencies&rdquo;). The vehicles listed on the
          Platform are owned, insured, maintained and operated by the
          Agencies, not by {company}. The rental agreement for any booking is
          formed directly between you and the Agency; Cibaura is not a party
          to it and does not itself rent, insure or deliver vehicles.
        </p>
        <p>
          Cibaura provides the booking infrastructure: listings, availability,
          server-computed pricing, payment processing, messaging, identity
          verification and dispute-escalation tooling. Each Agency is
          responsible for the accuracy of its listings, the roadworthiness and
          legal compliance of its vehicles (including insurance and
          registration), and the fulfilment of its bookings.
        </p>
      </Section>

      <Section id="accounts" title="3. Accounts, eligibility and identity verification">
        <p>
          You must be at least 18 years old to hold an account. Agencies may
          set a higher minimum driver age for their vehicles; it is displayed
          on every car page and checked against your date of birth on the
          pickup date. You must provide accurate registration information,
          keep your credentials confidential, and you are responsible for
          activity under your account.
        </p>
        <p>
          Before your first booking is accepted you must complete identity
          verification: photos of a government-issued ID and of a valid
          driver&rsquo;s license, the license number and expiry date, and your
          date of birth. Bookings are only available to verified customers
          whose license remains valid for the whole rental period. Agencies
          may refuse handover if the person collecting the car is not the
          verified renter or cannot present the verified license.
        </p>
        <p>
          You can reset a forgotten password from the log-in page; the link
          we email is valid for 30 minutes and can be used once. Resetting a
          password signs out every other session.
        </p>
      </Section>

      <Section id="bookings" title="4. Bookings, prices and payment">
        <p>
          Bookings follow a request-to-book flow: you send a request for
          specific dates and a pickup option; the Agency accepts or declines
          it. The Agency has 24 hours to respond; a request that is not
          answered in time, or whose pickup date arrives first, expires
          automatically and any hold on your card is released.
        </p>
        <p>
          All prices are computed by our servers and shown before you request:
          the daily rate set by the Agency, any delivery fee, and the Cibaura
          service fee. When you submit a request your payment card is{" "}
          <strong className="text-foreground">authorized</strong> (a temporary
          hold) for the total; it is{" "}
          <strong className="text-foreground">captured</strong> only when the
          Agency accepts. If the request is declined, expires, is cancelled
          before acceptance or cannot be fulfilled, the hold is released and
          nothing is charged. The price, the Agency&rsquo;s rental conditions
          and these Terms are frozen into your booking as the rental
          agreement at the moment you request.
        </p>
        <p>
          Payments are processed by Stripe. Your card details are collected
          and tokenized directly by Stripe and never touch {company}&rsquo;s
          servers; we store only a token, the card brand and its last four
          digits. Stripe&rsquo;s own terms apply to the processing of your
          payment. Rentals arranged directly with an Agency outside the
          Platform (walk-in bookings recorded by the Agency) are paid to the
          Agency under its own terms.
        </p>
      </Section>

      <Section id="cancellation" title="5. Cancellations, early returns and refunds">
        <p>
          The following policy applies to every booking made through the
          Platform. The figures below are the ones currently in force and are
          the same ones the Platform applies automatically; before you confirm
          a cancellation, your booking page shows the exact amount that will
          be refunded and the amount, if any, that will be retained.
        </p>
        <CancellationPolicySummary />
        <p>
          A hold that has not been captured is simply released. Captured
          amounts are refunded to the original payment method; depending on
          your bank, a refund can take several business days to appear. Any
          retained amount is paid to the Agency. Once the rental has started,
          self-service cancellation is no longer available: contact the Agency
          through the booking chat, or our support team, and they will cancel
          it for you.
        </p>
        <p>
          If an Agency cancels an accepted booking, fails to deliver the
          vehicle as agreed, or the vehicle becomes unavailable, you receive a
          full refund regardless of timing, and the Agency may face penalties
          up to removal from the Platform.
        </p>
      </Section>

      <Section id="rental" title="6. Pickup, delivery and your obligations as renter">
        <p>
          Vehicles are collected at the Agency&rsquo;s branch (its exact
          address, phone and opening hours are shared on your booking once it
          is accepted) or, where offered, delivered to an address you provide
          for the delivery fee shown at booking. You must inspect the vehicle
          at handover and report visible damage before driving off; the in-app
          chat on your booking is the record for this.
        </p>
        <p>
          During the rental you must hold a valid driver&rsquo;s license, obey
          traffic law, use the vehicle only as permitted by the Agency&rsquo;s
          rental conditions (no subletting, racing or illegal use), and return
          it at the agreed time, place and condition. Fuel policy, mileage
          limits, deposits, cross-border rules and driver-age surcharges are
          set by each Agency in the rental conditions displayed on the car
          page and stored with your booking.
        </p>
      </Section>

      <Section id="disputes" title="7. Damage, fines and disputes">
        <p>
          Damage to the vehicle, traffic fines, tolls and related costs during
          your rental are matters between you and the Agency under your rental
          agreement and the applicable insurance. Cibaura may provide booking
          records, messages and payment data to help resolve a dispute, and
          may, where the parties cannot agree, mediate in good faith, but
          Cibaura does not adjudicate liability.
        </p>
      </Section>

      <Section id="agencies" title="8. Agency terms and payouts">
        <p>
          Agencies must pass verification (business registration and owner
          identity) before their vehicles appear in public search, keep
          listings accurate (vehicle, photos, price, availability, rental
          conditions, minimum driver age), respond to requests within the
          response window, and honour accepted bookings. An Agency that
          breaches these obligations may be suspended, which removes its
          listings and dashboard access until the matter is resolved.
        </p>
        <p>
          Agency earnings (rental subtotal plus delivery fee, minus the
          Cibaura commission disclosed at acceptance) are credited to the
          Agency&rsquo;s wallet when the booking is settled after the return.
          Refunds issued after settlement are debited from the wallet in the
          same proportion. Agencies withdraw their available balance by
          requesting a payout to the bank account registered in their
          settings; payouts are paid by{" "}
          <strong className="text-foreground">
            manual bank transfer on a weekly cadence
          </strong>
          , and each transfer is recorded with the bank reference on the
          Agency&rsquo;s wallet page. Bank details are visible only to the
          Agency&rsquo;s settings holders and to {company}.
        </p>
        <p>
          Agencies are independent businesses. Nothing in these Terms creates
          an employment, agency (in the legal sense), partnership or joint
          venture between {company} and any Agency.
        </p>
      </Section>

      <Section id="conduct" title="9. Prohibited conduct">
        <p>
          You may not: circumvent the Platform to avoid fees after making
          contact through it; misrepresent your identity, age or documents;
          use another person&rsquo;s account or payment method without
          permission; scrape, probe or disrupt the Platform; post unlawful,
          deceptive or infringing content; or use the Platform to launder
          money or violate sanctions. We may suspend or terminate accounts
          that breach these Terms; a suspended account cannot log in until
          the suspension is lifted.
        </p>
      </Section>

      <Section id="liability" title="10. Disclaimers and limitation of liability">
        <p>
          The Platform is provided &ldquo;as is&rdquo;. To the maximum extent
          permitted by law, {company} disclaims all warranties regarding the
          vehicles and the conduct of Agencies and customers, and is not
          liable for indirect, incidental or consequential damages arising
          from a rental. Where liability cannot be excluded, {company}&rsquo;s
          aggregate liability for a booking is limited to the service fee it
          received for that booking. Nothing in these Terms limits liability
          that cannot be limited under the laws of {LEGAL.jurisdiction}.
        </p>
      </Section>

      <Section id="termination" title="11. Closing your account and termination">
        <p>
          You may delete your account at any time from your profile page after
          confirming your password. Deletion is refused while you have a
          requested, accepted or active booking, or while you own an Agency
          that is pending or verified; resolve those first. On deletion your
          profile is anonymized, your identity documents and saved cards are
          removed and every session is signed out; completed booking and
          payment records are retained as described in the Privacy Policy.
        </p>
        <p>
          We may suspend or terminate access for breach of these Terms,
          fraud, safety risk or legal requirement. Accepted bookings at the
          time of termination are wound down under Section 5.
        </p>
      </Section>

      <Section id="changes" title="12. Changes to these Terms">
        <p>
          We may update these Terms. Each revision carries a new version
          identifier (shown at the top of this page); when the version
          changes, you will be asked to accept the current Terms again before
          your next registration, password reset or booking request. Material
          changes will be announced on the Platform with reasonable notice.
        </p>
      </Section>

      <Section id="law" title="13. Governing law and contact">
        <p>
          These Terms are governed by the laws of the {LEGAL.jurisdiction}.
          Any dispute arising from these Terms or from the use of the
          Platform is subject to the exclusive jurisdiction of the courts of
          Santo Domingo, {LEGAL.jurisdiction}, without prejudice to any
          mandatory consumer-protection rules that apply to you.
        </p>
        <p>
          Questions about these Terms:{" "}
          <a
            href={`mailto:${LEGAL.contactEmail}`}
            className="text-primary underline underline-offset-2"
          >
            {LEGAL.contactEmail}
          </a>
          . Postal address: {company}, {LEGAL.address}.
        </p>
      </Section>
    </>
  );
}
