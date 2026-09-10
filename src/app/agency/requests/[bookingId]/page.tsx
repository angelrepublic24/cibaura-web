import { AgencyBookingDetail } from "@/features/agency/components/agency-booking-detail";
import { PermissionGate } from "@/features/agency/components/permission-gate";

/**
 * /agency/requests/[bookingId] — the AGENCY's booking detail: timeline,
 * accept / reject / cancel, the check-in and check-out inspections, the
 * deposit, claim and settlement cards, the renter's identity, pricing
 * snapshot and per-booking chat, all inside the dashboard chrome (RBAC
 * guard + nav come from the /agency layout). Reads need `bookings:read`;
 * each action gates itself on `bookings:handle`.
 */
type Props = { params: Promise<{ bookingId: string }> };

export default async function AgencyBookingDetailPage({ params }: Props) {
  const { bookingId } = await params;
  return (
    <PermissionGate permission="bookings:read">
      <AgencyBookingDetail bookingId={bookingId} />
    </PermissionGate>
  );
}
