import { Api } from "@/shared/api/client";
import {
  appNotificationListWireSchema,
  unreadCountWireSchema,
} from "@/modules/notifications/schema/notifications.schema";
import type { AppNotification } from "@/modules/notifications/types/notifications.types";

/**
 * Notifications API client — the ONLY thing in the module that talks to the
 * backend. Hooks call these, components call hooks.
 *
 * Backend routes (all session-scoped to the caller):
 *  - GET   /notifications               -> AppNotification[]
 *  - GET   /notifications/unread-count  -> { count }
 *  - PATCH /notifications/:id/read      -> 204
 *  - PATCH /notifications/read-all      -> 204
 */
class NotificationsService {
  async list(): Promise<AppNotification[]> {
    const res = await Api.get<unknown>("/notifications");
    return appNotificationListWireSchema.parse(res.data);
  }

  /** The badge number. The wrapper object is unwrapped here, not by callers. */
  async unreadCount(): Promise<number> {
    const res = await Api.get<unknown>("/notifications/unread-count");
    return unreadCountWireSchema.parse(res.data).count;
  }

  async markRead(id: string): Promise<void> {
    await Api.patch(`/notifications/${encodeURIComponent(id)}/read`);
  }

  async markAllRead(): Promise<void> {
    await Api.patch("/notifications/read-all");
  }
}

export const notificationsService = new NotificationsService();
