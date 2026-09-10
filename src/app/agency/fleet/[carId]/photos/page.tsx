import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CarPhotosManager } from "@/features/agency/components/car-photos-manager";

export const metadata = { title: "Car photos" };

/**
 * /agency/fleet/[carId]/photos — manage a car's gallery (upload, delete,
 * reorder). Backend RBAC (FLEET_WRITE + owning agency + branch scope) is the
 * real gate; this page just renders the manager.
 */
type Props = { params: Promise<{ carId: string }> };

export default async function CarPhotosPage({ params }: Props) {
  const { carId } = await params;
  return (
    <div className="max-w-3xl">
      <Link
        href="/agency/fleet"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to fleet
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Car photos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Real photos of this exact car. The first photo is the cover shown on
        search results.
      </p>
      <div className="mt-6">
        <CarPhotosManager carId={carId} />
      </div>
    </div>
  );
}
