import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (.next/standalone/server.js).
  output: "standalone",
  // Dev: every setup is previewable at <setup>.localhost:3710 (see lib/setup.ts).
  allowedDevOrigins: ["*.localhost"],
  // Pin the workspace root to this project so Turbopack doesn't walk up to $HOME.
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "loremflickr.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
