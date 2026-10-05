import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const repositoryRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  // Pages, drawings and images are built from ../content; nothing in it is read at runtime
  // (scripts/check-content.mjs and scripts/check-static.mjs hold the build to that).
  outputFileTracingRoot: repositoryRoot,
  turbopack: {
    root: repositoryRoot,
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
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
