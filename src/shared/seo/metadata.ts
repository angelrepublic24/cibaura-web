import type { Metadata } from "next";

import { SITE_URL } from "@/lib/config";
export { SITE_URL };

export const SITE_TITLE = "Cibaura — rent a car near you";
export const SITE_DESCRIPTION =
  "Find rental cars from local agencies and private hosts in the Dominican Republic. Compare cars and request your booking on Cibaura.";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function pageMetadata({
  title,
  description,
  path,
  image = "/brand/og.png",
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const socialTitle = `${title} · Cibaura`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: "website",
      siteName: "Cibaura",
      title: socialTitle,
      description,
      url: absoluteUrl(path),
      images: [{ url: absoluteUrl(image), alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [absoluteUrl(image)],
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
