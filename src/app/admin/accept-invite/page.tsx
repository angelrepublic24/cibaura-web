import Link from "next/link";
import { AcceptInviteForm } from "@/features/admin/components/accept-invite-form";
import { Logo } from "@/shared/components/logo";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata = { title: "Accept invite" };

/**
 * PUBLIC platform-admin invite acceptance page.
 *
 * Reached from the emailed link `${appUrl}/admin/accept-invite?token=<raw>`.
 * It must render for logged-out invitees — the /admin layout deliberately
 * skips its platform-admin RoleGuard for this exact path.
 */
export default async function AcceptInvitePage({ searchParams }: Props) {
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
          Platform administrator invitation.
        </p>
      </div>
      <AcceptInviteForm token={token} />
    </div>
  );
}
