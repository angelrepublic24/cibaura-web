"use client";

import { usePermission } from "@/features/agency/use-permission";
import { PERMISSION_LABELS, type AgencyPermission } from "@/features/agency/rbac";
import { getErrorMessage } from "@/shared/api/errors";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/shared/components/states";

/**
 * Page-level permission gate for agency dashboard screens. Fails CLOSED while
 * the session loads (spinner, never a flash of the "no access" card), shows
 * an error + retry when the session read itself fails (unknown permissions
 * are NOT a denial), and otherwise either renders the page or a calm
 * explanation naming the missing permission. UX only — the backend re-checks
 * every call.
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission: AgencyPermission;
  children: React.ReactNode;
}) {
  const { can, isPending, isError, error, refetch } = usePermission();

  if (isError) {
    return (
      <ErrorState
        title="Could not check your permissions"
        message={getErrorMessage(error, "Please try again.")}
        onRetry={refetch}
      />
    );
  }
  if (isPending) return <LoadingState label="Checking permissions…" />;
  if (!can(permission)) {
    return (
      <EmptyState
        title="Not available"
        description={`You need the "${PERMISSION_LABELS[permission]}" permission to open this page. Ask the agency owner to grant it.`}
      />
    );
  }
  return <>{children}</>;
}
