"use client";

import { useQuery } from "@tanstack/react-query";
import { AgencyApi, agencyKeys } from "@/features/agency/api";
import {
  AgencyProfileForm,
  PayoutBankDetailsForm,
} from "@/features/agency/components/agency-settings-form";
import { HostAgreementCard } from "@/features/agency/components/host-agreement-card";
import { PermissionGate } from "@/features/agency/components/permission-gate";
import { ErrorState, LoadingState } from "@/shared/components/states";

/**
 * /agency/settings — profile, rental conditions, the host agreement and the
 * payout bank account (`agency:settings`). The bank details are the one thing
 * here the backend only returns to holders of that permission, hence the
 * page-level gate; signing the agreement is additionally owner-only.
 */
export default function AgencySettingsPage() {
  return (
    <PermissionGate permission="agency:settings">
      <SettingsBody />
    </PermissionGate>
  );
}

function SettingsBody() {
  const query = useQuery({
    queryKey: agencyKeys.settings(),
    queryFn: AgencyApi.settings,
  });

  if (query.isPending) return <LoadingState label="Loading settings…" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Could not load your settings"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  const settings = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your public profile, the conditions customers accept when they book,
          your host agreement, and where your payouts go.
        </p>
      </div>

      <AgencyProfileForm settings={settings} />
      <HostAgreementCard />
      <PayoutBankDetailsForm settings={settings} />
    </div>
  );
}
