import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { aiServiceUrl } from "./src/config/ai-service";

const nextConfig: NextConfig = {
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
