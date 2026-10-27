import Link from "next/link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";
import { Logo } from "@/shared/components/logo";
import { pageMetadata } from "@/shared/seo/metadata";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata() {
  return pageMetadata({ title: "Create account", description: "Create your Cibaura account to request car rentals in the Dominican Republic and the United States.", path: "/auth/register", noIndex: true });
}

export default async function RegisterPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;

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
      <RedirectIfAuthenticated>
        <RegisterForm next={next} />
      </RedirectIfAuthenticated>
    </div>
  );
}
