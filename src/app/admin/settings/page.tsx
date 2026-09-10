"use client";

import { PlatformConfigForm } from "@/features/admin/components/platform-config-form";
import { usePlatformConfig } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import { ErrorState, LoadingState } from "@/shared/components/states";

/**
 * /admin/settings — the platform configuration (spec §0.7): commission,
 * cancellation tiers, dispute/claim windows, deposit defaults, check-in and
 * inspection rules, media retention and the Stripe payout switch. One form,
 * one `PATCH /admin/config` with only the changed keys.
 */
export default function AdminSettingsPage() {
  const config = usePlatformConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Platform-wide configuration. Every figure here is what the server
          enforces — customers and hosts see the same numbers.
        </p>
      </div>

      {config.isLoading ? (
        <LoadingState label="Loading configuration…" />
      ) : config.isError ? (
        <ErrorState
          title="Could not load configuration"
          message={getErrorMessage(config.error, "Please try again.")}
          onRetry={() => config.refetch()}
        />
      ) : config.data ? (
        <PlatformConfigForm config={config.data} />
      ) : null}
    </div>
  );
}
