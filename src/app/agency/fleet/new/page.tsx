import { NewCarForm } from "@/features/agency/components/new-car-form";

export const metadata = { title: "Add car" };

/** /agency/fleet/new — catalog-driven car listing form. */
export default function NewCarPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Add a car</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Make and model come from the platform catalog so search filters
        stay clean — free text is not allowed.
      </p>
      <div className="mt-6">
        <NewCarForm />
      </div>
    </div>
  );
}
