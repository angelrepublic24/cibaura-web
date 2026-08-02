import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { Logo } from "@/shared/components/logo";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: Props) {
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
      <LoginForm next={next} />
    </div>
  );
}
