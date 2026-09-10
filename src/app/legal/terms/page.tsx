import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of the Cibaura rent-a-car marketplace.",
};

/**
 * /legal/terms — Terms of Service for the marketplace. Bracketed
 * [PLACEHOLDER] values (legal entity, jurisdiction, contact) must be
 * replaced by counsel before launch; the operational terms mirror how the
 * platform actually works (request-to-book, capture on accept, Stripe,
 * KYC gate, agencies own the vehicles).
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

export default function TermsPage() {
  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-foreground">
          Terms of Service
        </h1>
        <p className="text-sm text-muted-foreground">
          Last updated: September 4, 2026
        </p>
      </header>

      <Section title="1. Who we are">
        <p>
          Cibaura (&ldquo;Cibaura&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is
          a rent-a-car marketplace operated by{" "}
          <Placeholder>COMPANY LEGAL NAME</Placeholder>, a company registered in{" "}
          <Placeholder>JURISDICTION / REGISTRY NUMBER</Placeholder>, with
          registered address at <Placeholder>REGISTERED ADDRESS</Placeholder>.
          These Terms of Service (the &ldquo;Terms&rdquo;) govern your access to
          and use of the Cibaura website, applications and services (together,
          the &ldquo;Platform&rdquo;).
        </p>
        <p>
          By creating an account or using the Platform you agree to these Terms
          and to our{" "}
          <Link
            href="/legal/privacy"
            className="text-primary underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Platform.
        </p>
      </Section>

      <Section title="2. Cibaura is an intermediary — agencies own the cars">
        <p>
          Cibaura is a marketplace that connects customers with independent,
          verified rent-a-car agencies (&ldquo;Agencies&rdquo;). The vehicles
          listed on the Platform are owned, maintained and operated by the
          Agencies, not by Cibaura. The rental agreement for any booking is
          formed directly between you and the Agency; Cibaura is not a party to
          it and does not itself rent, insure or deliver vehicles.
        </p>
        <p>
          Cibaura provides the booking infrastructure: listings, availability,
          server-computed pricing, payments, messaging and dispute-escalation
          tooling. Each Agency is responsible for the accuracy of its listings,
          the roadworthiness and legal compliance of its vehicles (including
          insurance and registration), and the fulfilment of its bookings.
        </p>
      </Section>

      <Section title="3. Accounts and eligibility">
        <p>
          You must be at least 18 years old (or the minimum driving-rental age
          in your jurisdiction, if higher) to rent a vehicle. You must provide
          accurate registration information and keep your credentials
          confidential; you are responsible for activity under your account.
        </p>
        <p>
          Before your first booking is accepted you must complete identity
          verification: a government-issued ID and a valid driver&rsquo;s
          licence. Bookings are only available to verified customers whose
          licence is valid for the whole rental period. Agencies may refuse
          handover if the person collecting the car is not the verified renter
          or cannot present the verified licence.
        </p>
      </Section>

      <Section title="4. Bookings, prices and payment">
        <p>
          Bookings follow a request-to-book flow: you send a request for
          specific dates; the Agency accepts or rejects it. Requests that are
          not answered within the displayed response window expire
          automatically.
        </p>
        <p>
          All prices are computed by our servers and shown before you request:
          the daily rate set by the Agency, any delivery fee, and the Cibaura
          service fee. When you submit a request, your payment card is
          authorized (a hold) for the total; it is captured only when the
          Agency accepts. If the request is rejected, expires or cannot be
          fulfilled, the hold is released.
        </p>
        <p>
          Payments are processed by Stripe, Inc. (&ldquo;Stripe&rdquo;). Your
          card details are collected and tokenized directly by Stripe and never
          touch Cibaura&rsquo;s servers. Stripe&rsquo;s own terms apply to the
          processing of your payment.
        </p>
      </Section>

      <Section title="5. Cancellations and refunds">
        <p>
          You may cancel a pending request at any time free of charge. Once a
          booking is accepted, cancellations and refunds follow the
          cancellation policy shown on the booking at the time of acceptance
          (<Placeholder>SUMMARIZE / LINK FINAL CANCELLATION POLICY</Placeholder>).
          Refunds are returned to the original payment method.
        </p>
        <p>
          If an Agency cancels an accepted booking or fails to deliver the
          vehicle as agreed, you receive a full refund and the Agency may face
          penalties up to removal from the Platform.
        </p>
      </Section>

      <Section title="6. Pickup, delivery and your obligations as renter">
        <p>
          Vehicles are collected at the Agency&rsquo;s branch or, where offered,
          delivered to an address you provide for the delivery fee shown at
          booking. You must inspect the vehicle at handover and report visible
          damage before driving off — the in-app chat on your booking is the
          record for this.
        </p>
        <p>
          During the rental you must: hold a valid driver&rsquo;s licence, obey
          traffic law, use the vehicle only as permitted by the Agency&rsquo;s
          rental terms (no subletting, racing or illegal use), and return it at
          the agreed time, place and condition. Fuel policy, mileage limits,
          cross-border rules and driver-age surcharges are set by each Agency
          in its listing or rental agreement.
        </p>
      </Section>

      <Section title="7. Damage, fines and disputes">
        <p>
          Damage to the vehicle, traffic fines, tolls and related costs during
          your rental are matters between you and the Agency under your rental
          agreement and the applicable insurance. Cibaura may provide booking
          records, messages and payment data to help resolve a dispute, and may
          — where the parties cannot agree — mediate in good faith, but Cibaura
          does not adjudicate liability.
        </p>
      </Section>

      <Section title="8. Agency terms">
        <p>
          Agencies must pass verification before their vehicles appear in
          public search, keep listings accurate (vehicle, photos, price,
          availability), respond to requests promptly, and honour accepted
          bookings. Agency earnings (rental subtotal plus delivery fee, minus
          the Cibaura commission disclosed at acceptance) are credited to the
          Agency wallet after settlement and paid out per the payout schedule.
        </p>
        <p>
          Agencies are independent businesses. Nothing in these Terms creates
          an employment, agency (in the legal sense), partnership or joint
          venture between Cibaura and any Agency.
        </p>
      </Section>

      <Section title="9. Prohibited conduct">
        <p>
          You may not: circumvent the Platform to avoid fees after making
          contact through it; misrepresent your identity or documents; use
          another person&rsquo;s account or payment method without permission;
          scrape, probe or disrupt the Platform; post unlawful, deceptive or
          infringing content; or use the Platform to launder money or violate
          sanctions. We may suspend or terminate accounts that breach these
          Terms.
        </p>
      </Section>

      <Section title="10. Disclaimers and limitation of liability">
        <p>
          The Platform is provided &ldquo;as is&rdquo;. To the maximum extent
          permitted by law, Cibaura disclaims all warranties regarding the
          vehicles and the conduct of Agencies and customers, and is not liable
          for indirect, incidental or consequential damages arising from a
          rental. Where liability cannot be excluded, Cibaura&rsquo;s aggregate
          liability for a booking is limited to the service fee Cibaura
          received for that booking. Nothing in these Terms limits liability
          that cannot be limited by law.
        </p>
      </Section>

      <Section title="11. Termination">
        <p>
          You may close your account at any time. We may suspend or terminate
          access for breach of these Terms, fraud, safety risk or legal
          requirement. Accepted bookings at the time of termination are wound
          down under Section 5.
        </p>
      </Section>

      <Section title="12. Changes to these Terms">
        <p>
          We may update these Terms; material changes will be announced on the
          Platform with reasonable notice. Continued use after the effective
          date constitutes acceptance of the revised Terms.
        </p>
      </Section>

      <Section title="13. Governing law and contact">
        <p>
          These Terms are governed by the laws of{" "}
          <Placeholder>GOVERNING LAW JURISDICTION</Placeholder>, and disputes
          are subject to the courts of{" "}
          <Placeholder>VENUE / ARBITRATION CLAUSE</Placeholder>. Questions
          about these Terms:{" "}
          <Placeholder>LEGAL CONTACT EMAIL</Placeholder>.
        </p>
      </Section>
    </>
  );
}
