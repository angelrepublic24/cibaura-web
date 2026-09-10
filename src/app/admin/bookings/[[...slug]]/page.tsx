import { redirect } from "next/navigation";

/**
 * /admin/bookings(/:id) — legacy path kept alive for stored notification
 * links (admin alerts used to point here). The console screen is
 * /admin/orders; forward with the id intact so an old alert still opens the
 * right order.
 */
type Props = { params: Promise<{ slug?: string[] }> };

export default async function AdminBookingsRedirect({ params }: Props) {
  const { slug } = await params;
  const id = slug?.[0];
  redirect(id ? `/admin/orders/${id}` : "/admin/orders");
}
