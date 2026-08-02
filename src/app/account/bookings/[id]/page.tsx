import { BookingDetail } from "@/features/bookings/components/booking-detail";

/**
 * /account/bookings/[id] — booking detail: state timeline + pricing
 * snapshot + chat placeholder + cancel affordance.
 */
type Props = { params: Promise<{ id: string }> };

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params;
  return <BookingDetail bookingId={id} />;
}
