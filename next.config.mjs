const umamiServer = (process.env.NEXT_PUBLIC_UMAMI_SERVER_URL || 'https://cloud.umami.is').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    if (!process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) return [];
    return [
      {
        source: '/stats/script.js',
        destination: `${umamiServer}/script.js`,
      },
    ];
  },
};

export default nextConfig;
