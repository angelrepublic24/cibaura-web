import type { Metadata } from "next";

import { SITE_URL } from "@/lib/config";
export { SITE_URL };

export const SITE_TITLE = "Cibaura — rent a car near you";
/**
 * The social preview, with the ART VERSION IN THE FILENAME.
 *
 * Facebook, WhatsApp, X and Slack cache a preview against its URL. Swapping
 * the bytes behind an unchanged `/brand/og.png` is invisible to them: the old
 * thumbnail keeps being served for days because nothing tells them to refetch.
 * Bumping this path is what actually propagates new artwork.
 *
 * Changing the art means a NEW filename here, not an overwrite.
 */
export const OG_IMAGE = "/brand/og-2026-10.png";

export const SITE_DESCRIPTION =
  "Find rental cars from local agencies and private hosts in the Dominican Republic and the United States. Compare cars and request your booking on Cibaura.";

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href;
}

export function pageMetadata({
  title,
  description,
  path,
  image = OG_IMAGE,
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
