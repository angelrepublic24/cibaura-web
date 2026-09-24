import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { Logo } from "@/shared/components/logo";
import { pageMetadata } from "@/shared/seo/metadata";

export function generateMetadata() {
  return pageMetadata({ title: "Create account", description: "Create your Cibaura account to request car rentals in the Dominican Republic.", path: "/auth/register", noIndex: true });
}

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link
          href="/"
          aria-label="Cibaura home"
          className="inline-flex rounded-[var(--radius-sm)]"
        >
          <Logo priority />
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          Reservations and rentals, all in one place.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
