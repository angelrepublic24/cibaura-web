import { z } from "zod";

/**
 * Notification wire schemas (zod v4). `NotificationsService` validates every
 * response against these; the `z.infer` types live in
 * `../types/notifications.types`.
 */

/** One row of the in-app bell feed (`GET /notifications`). */
export const appNotificationWireSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  /** Where opening it should go, when the event has a destination. */
  linkUrl: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const appNotificationListWireSchema = z.array(
  appNotificationWireSchema,
);

/** `GET /notifications/unread-count` — the badge number, wrapped. */
export const unreadCountWireSchema = z.object({
  count: z.number(),
});
