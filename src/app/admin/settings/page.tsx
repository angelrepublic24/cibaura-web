"use client";

import { PlatformConfigForm } from "@/features/admin/components/platform-config-form";
import { usePlatformConfig } from "@/features/admin/hooks";
import { getErrorMessage } from "@/shared/api/errors";
import { ErrorState, LoadingState } from "@/shared/components/states";

/** Editable settings use the deployed commission and cancellation-policy routes. */
export default function AdminSettingsPage() {
  const config = usePlatformConfig();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage commission and cancellation policy. Additional settings are
          unavailable until saving them is supported.
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
