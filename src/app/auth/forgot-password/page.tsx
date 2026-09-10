import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { Logo } from "@/shared/components/logo";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
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
          We will email you a link to choose a new password.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
