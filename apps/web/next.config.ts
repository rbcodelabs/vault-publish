import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required for Prisma driver adapters
    serverComponentsExternalPackages: ["@prisma/client", "pg"],
  },
  transpilePackages: ["@vault-publish/parser", "@vault-publish/db"],
};

export default nextConfig;
