import { AgencyBookingDetail } from "@/features/agency/components/agency-booking-detail";

/**
 * /agency/requests/[bookingId] — the AGENCY's booking detail: timeline,
 * lifecycle actions (accept/reject → pickup → return → settle), pricing
 * snapshot and per-booking chat, all inside the dashboard chrome (RBAC
 * guard + nav come from the /agency layout).
 */
type Props = { params: Promise<{ bookingId: string }> };

export default async function AgencyBookingDetailPage({ params }: Props) {
  const { bookingId } = await params;
  return <AgencyBookingDetail bookingId={bookingId} />;
}
