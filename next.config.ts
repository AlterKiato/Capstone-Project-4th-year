import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js can log Server Function arguments in development, including credentials.
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/(?:dashboard\/student\/)?verify-email(?:[/?]|$)/] },
  },
  // Keep the owned verification test server separate from the developer's running server.
  ...(process.env.THESISHS_VERIFICATION_ACCEPTANCE === "1" ? {
    distDir: ".next/phase101b2",
    typescript: { tsconfigPath: "tsconfig.verification.json" },
  } : {}),
  async headers() {
    return ["/verify-email", "/dashboard/student/verify-email"].map(source => ({ source, headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ] }));
  },
  experimental: {
    serverActions: {
      // Allow a 10 MiB upload plus multipart form-data overhead.
      bodySizeLimit: 11 * 1024 * 1024,
    },
  },
};

export default nextConfig;
