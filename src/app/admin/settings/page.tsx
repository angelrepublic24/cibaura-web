"use client";

import { PlatformConfigForm } from "@/modules/admin/components/platform-config-form";
import { usePlatformConfig } from "@/modules/admin/hooks/admin.hook";
import { getErrorMessage } from "@/shared/api/errors";
import { ErrorState, LoadingState } from "@/shared/components/states";

/** Every platform setting, saved in one PATCH /admin/config. */
export default function AdminSettingsPage() {
  const config = usePlatformConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Commission, tax, cancellation policy, claim deadlines, deposits,
          inspections and payouts. Saved together; the server validates every
          field before it writes any of them.
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
