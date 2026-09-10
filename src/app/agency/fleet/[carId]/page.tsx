import { CarManage } from "@/features/agency/components/car-manage";

export const metadata = { title: "Manage car" };

/**
 * /agency/fleet/[carId] — publish/pause, edit the listing, upload the
 * registration document and jump to the gallery. Backend RBAC (fleet
 * permissions + owning agency + branch scope) is the real gate; the client
 * gate only shapes what renders.
 */
type Props = { params: Promise<{ carId: string }> };

export default async function ManageCarPage({ params }: Props) {
  const { carId } = await params;
  return <CarManage carId={carId} />;
}
