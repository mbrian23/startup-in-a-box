/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: '/deck',
  experimental: { optimizePackageImports: ['lucide-react'] },
};
export default nextConfig;
