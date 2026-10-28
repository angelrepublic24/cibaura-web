import type { z } from "zod";
import type {
  appNotificationWireSchema,
  unreadCountWireSchema,
} from "@/modules/notifications/schema/notifications.schema";

/**
 * Notification types — every one is the `z.infer` of a schema in `../schema`,
 * so the schema is the single source of truth.
 */

/** In-app notification (bell feed). */
export type AppNotification = z.infer<typeof appNotificationWireSchema>;
export type UnreadCountWire = z.infer<typeof unreadCountWireSchema>;
