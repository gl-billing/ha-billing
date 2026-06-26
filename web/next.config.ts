import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/** Mac Wi‑Fi IP so phones on the same network can load /_next assets in dev. */
function lanIpForDev(): string | undefined {
  const fromEnv = process.env.DEV_LAN_IP?.trim();
  if (fromEnv) return fromEnv;
  try {
    return (
      execSync("ipconfig getifaddr en0", { encoding: "utf8" }).trim() ||
      execSync("ipconfig getifaddr en1", { encoding: "utf8" }).trim() ||
      undefined
    );
  } catch {
    return undefined;
  }
}

const lan = lanIpForDev();
const allowedDevOrigins = ["localhost", "127.0.0.1", ...(lan ? [lan] : [])];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["googleapis", "playwright-core", "@sparticuz/chromium"],
  allowedDevOrigins,
  webpack: (config, { dev, isServer }) => {
    // Avoids broken pages (missing .js chunks, no CSS) after heavy hot-reload during dev.
    if (dev) config.cache = false;
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        child_process: false
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=86400" }
        ]
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript" },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      }
    ];
  }
};

export default nextConfig;
