import type { NextConfig } from "next";
import { getGiftDataSource } from "./src/db/config";

const isGithubPages = process.env.GITHUB_PAGES === "true";
const isStaticPreview = getGiftDataSource() === "starter";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: isStaticPreview ? "export" : undefined,
  pageExtensions: isStaticPreview ? ["tsx", "ts", "jsx", "js"] :
    ["tsx", "ts", "jsx", "js", "private.tsx", "private.ts"],
  distDir: process.env.ISOLATED_PREVIEW === "true" ? ".next-preview" :
    process.env.NODE_ENV === "development" ? ".next-dev" :
    isStaticPreview ? undefined : ".next-server",
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  basePath: isGithubPages ? "/made-for-them" : undefined,
  trailingSlash: isGithubPages ? true : undefined,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
