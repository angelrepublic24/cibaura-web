import { Api } from "@/shared/api/client";

/** In-app notification (bell feed). */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => ["notifications", "list"] as const,
  unread: () => ["notifications", "unread"] as const,
};

export const NotificationsApi = {
  async list(): Promise<AppNotification[]> {
    const res = await Api.get("/notifications");
    return res.data;
  },
  async unreadCount(): Promise<number> {
    const res = await Api.get("/notifications/unread-count");
    return res.data.count;
  },
  async markRead(id: string): Promise<void> {
    await Api.patch(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await Api.patch("/notifications/read-all");
  },
};
