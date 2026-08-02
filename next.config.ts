import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Stock-photo fallback host (see src/features/cars/photos.ts) plus any
    // real agency-uploaded photos we may serve. Cars render with next/image
    // `unoptimized`, but allow-listing the host keeps the door open for the
    // optimizer and blocks unknown remote hosts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
