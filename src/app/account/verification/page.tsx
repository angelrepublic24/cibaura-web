"use client";

import { VerificationPanel } from "@/features/verification/components/verification-panel";

/**
 * /account/verification — the customer identity/licence verification surface.
 * The /account layout already gates authenticated users; the panel drives the
 * whole flow (submit licence → upload photos → await review).
 */
export default function AccountVerificationPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-foreground">
          Identity verification
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity and driver&apos;s licence once — then book any car
          on Cibaura.
        </p>
      </div>
      <VerificationPanel />
    </div>
  );
}
