import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/modules/notifications/services/notifications.service";

/** Query keys for the notifications module (the only cache it owns). */
export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => ["notifications", "list"] as const,
  unread: () => ["notifications", "unread"] as const,
};

/**
 * The badge count. Polled once a minute so a notification raised on another
 * device shows up without a reload, and idle for guests — the endpoint is
 * session-scoped and would only 401.
 */
export function useUnreadNotificationCount(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationsService.unreadCount(),
    enabled,
    refetchInterval: 60_000,
  });
}

/** The feed itself — fetched only while the dropdown is actually open. */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationsService.list(),
    enabled,
  });
}

/**
 * Both mutations invalidate the whole module subtree: marking one row read
 * changes the badge as well as the list, so refreshing only one of them
 * would leave the other lying.
 */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
