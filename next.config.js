/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Experimental features to fix chunk loading
  experimental: {
    serverComponentsExternalPackages: ['@google/genai'],
  },
}

module.exports = nextConfig

