import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/shared/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account$", "/account/", "/agency$", "/agency/", "/admin$", "/admin/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
