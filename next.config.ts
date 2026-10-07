import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow a 10 MiB upload plus multipart form-data overhead.
      bodySizeLimit: 11 * 1024 * 1024,
    },
  },
};

export default nextConfig;
