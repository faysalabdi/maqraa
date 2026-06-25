import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Per-user app surfaces require auth and shouldn't be crawled.
      disallow: ["/path", "/words", "/review", "/stats", "/settings", "/upload", "/admin", "/book"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
