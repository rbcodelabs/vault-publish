import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Prisma driver adapters
  serverExternalPackages: ["@prisma/client", "pg"],
  transpilePackages: ["@vault-publish/parser", "@vault-publish/db"],
};

export default nextConfig;
