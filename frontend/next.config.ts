import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pixi/react", "pixi.js", "pixi-viewport"],
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  async rewrites() {
    return [
      {
        source: "/deck",
        destination: "https://startup-deck-seven.vercel.app/deck",
      },
      {
        source: "/deck/:path*",
        destination: "https://startup-deck-seven.vercel.app/deck/:path*",
      },
    ];
  },
};

export default nextConfig;
