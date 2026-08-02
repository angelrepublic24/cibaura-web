import { Api } from "@/shared/api/client";
import type {
  Booking,
  BookingState,
  Message,
  MessageThreadWithMessages,
  PickupType,
  Pricing,
  Quote,
} from "@/shared/types/domain";

/**
 * Bookings API module (server quote + request-to-book + detail + chat).
 *
 * Backend contract (docs/DOMAIN.md, all under /api):
 *  - POST /bookings/quote  { carId, start, end, pickupType?, deliveryZoneId? }
 *      -> { pricing: Pricing }   (SERVER-side price preview; NO booking created)
 *  - POST /bookings  { carId, start, end, pickupType?, deliveryZoneId? }
 *      -> Booking (state=requested; payment AUTHORIZED at request, captured
 *         at agency accept)
 *  - GET  /bookings/mine    -> Booking[]   (bare array — customer's bookings)
 *  - GET  /bookings/agency  -> Booking[]   (bare array — managing agency)
 *  - GET  /bookings/:bookingId -> Booking  (owner customer OR managing agency)
 *  - POST /bookings/:bookingId/{accept,reject,pickup,return,settle,cancel}
 *      -> Booking (per-role state transitions)
 *
 * Chat lives on the messaging surface:
 *  - GET  /messages/bookings/:bookingId       -> { thread, messages: Message[] }
 *  - POST /messages/bookings/:bookingId { body } -> Message (the created one)
 */

export const bookingKeys = {
  all: ["bookings"] as const,
  mine: (filters: { state?: BookingState } = {}) =>
    ["bookings", "me", filters] as const,
  agency: (filters: { state?: BookingState } = {}) =>
    ["bookings", "agency", filters] as const,
  detail: (bookingId: string) => ["bookings", "detail", bookingId] as const,
  messages: (bookingId: string) => ["bookings", "messages", bookingId] as const,
};

/**
 * Matches the backend request body for both the quote preview and the
 * request-to-book (flat, half-open `[start, end)`).
 */
export interface QuoteInput {
  carId: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, half-open [start, end)
  pickupType?: PickupType;
  /** Delivery: EITHER a predefined zone… */
  deliveryZoneId?: string;
  /** …OR a geocoded address (Google Places) — the server computes the fee. */
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryReference?: string;
}

export type RequestBookingInput = QuoteInput;

export const BookingsApi = {
  /**
   * Server-computed price preview shown BEFORE the booking is created.
   * Clients render the returned cents verbatim — never multiply days×rate.
   */
  async quote(input: QuoteInput): Promise<Pricing> {
    const res = await Api.post<Quote>("/bookings/quote", input);
    return res.data.pricing;
  },

  async request(input: RequestBookingInput): Promise<Booking> {
    const res = await Api.post("/bookings", input);
    return res.data;
  },

  async findMine(): Promise<Booking[]> {
    const res = await Api.get("/bookings/mine");
    return res.data;
  },

  async findByAgency(): Promise<Booking[]> {
    const res = await Api.get("/bookings/agency");
    return res.data;
  },

  async findById(bookingId: string): Promise<Booking> {
    const res = await Api.get(`/bookings/${bookingId}`);
    return res.data;
  },

  async cancel(bookingId: string, reason?: string): Promise<Booking> {
    const res = await Api.post(`/bookings/${bookingId}/cancel`, { reason });
    return res.data;
  },

  /**
   * The backend returns `{ thread, messages }`; the chat UI only needs the
   * ordered messages, so we unwrap `.messages` here (the thread ref is
   * derivable from the booking and unused by the panel).
   */
  async listMessages(bookingId: string): Promise<Message[]> {
    const res = await Api.get<MessageThreadWithMessages>(
      `/messages/bookings/${bookingId}`,
    );
    return res.data.messages;
  },

  async sendMessage(bookingId: string, body: string): Promise<Message> {
    const res = await Api.post(`/messages/bookings/${bookingId}`, { body });
    return res.data;
  },
};
