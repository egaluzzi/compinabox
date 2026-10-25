import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/env";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (isStaging()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/employee",
        "/vendor",
        "/checkout",
        "/onboarding",
        "/login",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).toString(),
  };
}
