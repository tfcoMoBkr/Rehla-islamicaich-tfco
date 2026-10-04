import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { aiServiceUrl } from "./src/config/ai-service";

const repositoryRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Lesson and source data live in ../content and are read at request time.
  outputFileTracingRoot: repositoryRoot,
  outputFileTracingIncludes: {
    "/**": ["../content/**/*.json", "../content/media/**/*", "../content/art/**/*.svg", "../content/art/**/*.png"],
  },
  turbopack: {
    root: repositoryRoot,
  },
  experimental: {
    // Rafiq checks every answer against its sources before replying, which can take longer than
    // the default 30 s on free model tiers.
    proxyTimeout: 90_000,
  },
  async redirects() {
    return [
      {
        source: "/:locale(ar|en)/talk-to-a-human",
        destination: "/:locale/talk-to-a-specialist",
        permanent: true,
      },
    ];
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
