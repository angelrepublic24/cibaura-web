import Link from "next/link";
import { buttonVariants } from "@/shared/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page you are looking for does not exist or was moved.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Back to home
      </Link>
    </div>
  );
}
