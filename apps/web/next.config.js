/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Needed for App Router
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Strict mode for React
  reactStrictMode: true,
  // Package alias so the shared package resolves
  transpilePackages: ["@skilllens/shared"],
};

module.exports = nextConfig;
