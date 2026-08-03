import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/shared/providers/query-provider";
import { SiteHeader } from "@/shared/components/site-header";
import { Logo } from "@/shared/components/logo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cibaura.com"),
  title: {
    default: "Cibaura — rent a car near you",
    template: "%s · Cibaura",
  },
  description:
    "Multi-vendor rent-a-car marketplace: search by city and dates, compare local agencies, book in minutes.",
  openGraph: {
    title: "Cibaura — mobility, reservations, rental marketplace",
    description:
      "Search by city and dates, compare local agencies, book in minutes.",
    siteName: "Cibaura",
    images: [{ url: "/brand/og.png", width: 1200, height: 630, alt: "Cibaura" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cibaura — mobility, reservations, rental marketplace",
    description:
      "Search by city and dates, compare local agencies, book in minutes.",
    images: ["/brand/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <SiteHeader />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="mt-20 bg-navy text-navy-foreground">
            <div className="mx-auto max-w-6xl px-4 py-12">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-sm space-y-3">
                  <Logo onDark />
                  <p className="text-xs leading-relaxed text-cream/70">
                    Mobility · Reservations · Rental marketplace. Rent a car
                    from verified local agencies — prices are always computed by
                    the server.
                  </p>
                </div>
                <nav className="flex flex-col gap-2 text-sm text-cream/80">
                  <span className="text-xs font-semibold uppercase tracking-wide text-cream/50">
                    Explore
                  </span>
                  <Link href="/cars/santiago" className="hover:text-cream">
                    Browse cars
                  </Link>
                  <Link href="/agencies" className="hover:text-cream">
                    Agencies
                  </Link>
                  <Link href="/become-agency" className="hover:text-cream">
                    Become an agency
                  </Link>
                  <Link href="/auth/login" className="hover:text-cream">
                    Log in
                  </Link>
                </nav>
              </div>
              <div className="mt-10 flex flex-col items-center gap-2 border-t border-cream/10 pt-6 text-xs text-cream/60 sm:flex-row sm:justify-between">
                <span>
                  © {new Date().getFullYear()} Cibaura. All rights reserved.
                </span>
                <span>
                  Built by{" "}
                  <a
                    href="https://drts.us"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-cream underline-offset-2 hover:underline"
                  >
                    drts.us
                  </a>
                </span>
              </div>
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
