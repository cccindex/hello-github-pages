import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/hello-github-pages",
        assetPrefix: "/hello-github-pages",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
