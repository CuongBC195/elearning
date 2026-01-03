/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable webpack cache to avoid chunk loading issues
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
      // Disable chunk optimization in dev to prevent module not found errors
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig

