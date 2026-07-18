import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@maqraa/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb", // PDF imports
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
    ],
  },
};

export default nextConfig;
