import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // This app lives in a subdirectory of another repository; pin the root so
  // Turbopack does not pick up the parent lockfile.
  turbopack: { root: path.resolve(__dirname) },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // CSV imports are sent in chunks, but each chunk can carry a few hundred rows.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
