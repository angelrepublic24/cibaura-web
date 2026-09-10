import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { Logo } from "@/shared/components/logo";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Reset password" };

/**
 * /auth/reset-password?token=… — landing page of the password-reset email
 * (and of the app deep link `cibaura://reset-password?token=…`). The token
 * is read server-side from the query string and handed to the form; every
 * invalid/expired/used outcome renders its own honest state.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : undefined;

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
      <ResetPasswordForm token={token} />
    </div>
  );
}
