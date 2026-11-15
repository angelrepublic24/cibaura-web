"use client";

import { VerificationPanel } from "@/modules/verification/components/verification-panel";
import { SettingsPageTitle } from "@/modules/account/components/settings-section";

/**
 * /account/settings/documents — the customer identity/license verification surface.
 * The /account layout already gates authenticated users; the panel drives the
 * whole flow (submit license → upload photos → await review).
 */
export default function AccountVerificationPage() {
  return (
    <div className="w-full">
      <SettingsPageTitle title="Documents" description="Your driver's license details and photos, together." />
      <VerificationPanel />
    </div>
  );
}
