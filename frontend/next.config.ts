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
        destination: "https://startup-deck-seven.vercel.app/",
      },
      {
        source: "/deck/:path*",
        destination: "https://startup-deck-seven.vercel.app/:path*",
      },
    ];
  },
};

export default nextConfig;
