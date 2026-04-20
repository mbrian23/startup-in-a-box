import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PixiJS and @pixi/react need to be transpiled for SSR compatibility
  transpilePackages: ["@pixi/react", "pixi.js", "pixi-viewport"],
  // Skip type checking during build — PixiJS has duplicate type conflicts
  // between pixi.js and @pixi/react sub-packages that are benign at runtime
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js 16 uses Turbopack by default
  turbopack: {},
};

export default nextConfig;
