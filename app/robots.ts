import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/employee",
        "/checkout",
        "/onboarding",
        "/login",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
