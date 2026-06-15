/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  transpilePackages: ["@zoe/api-client", "@zoe/domain", "@zoe/ui"]
};

export default nextConfig;
