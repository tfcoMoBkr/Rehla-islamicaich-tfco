import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { aiServiceUrl } from "./src/config/ai-service";

const repositoryRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Lesson and source data live in ../content and are read at request time.
  outputFileTracingRoot: repositoryRoot,
  outputFileTracingIncludes: {
    "/*": ["../content/**/*.json"],
  },
  turbopack: {
    root: repositoryRoot,
  },
  async rewrites() {
    return [
      {
        source: "/api/ai/:path*",
        destination: `${aiServiceUrl}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
