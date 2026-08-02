import type { Metadata } from "next";
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
            <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-12 text-center sm:flex-row sm:justify-between sm:text-left">
              <Logo onDark />
              <p className="max-w-md text-xs leading-relaxed text-cream/70">
                Mobility · Reservations · Rental marketplace. Rent a car from
                verified local agencies — prices are always computed by the
                server.
              </p>
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
