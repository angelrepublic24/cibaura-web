import { z } from "zod";

/** Backend `CancelBookingDto` / `RejectBookingDto`: reason 2..160 characters. */
export const BOOKING_REASON_MIN = 2;
export const BOOKING_REASON_MAX = 160;

/** `POST /bookings/:id/cancel { reason }` — the reason is shown to the agency. */
export const cancelBookingSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Tell the agency why you are cancelling (at least 3 characters)")
    .max(
      BOOKING_REASON_MAX,
      `Keep the reason to ${BOOKING_REASON_MAX} characters or fewer`,
    ),
});
export type CancelBookingFormValues = z.infer<typeof cancelBookingSchema>;
