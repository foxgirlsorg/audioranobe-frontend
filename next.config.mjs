const umamiServer = (process.env.NEXT_PUBLIC_UMAMI_SERVER_URL || 'https://cloud.umami.is').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // A verification build must not overwrite the dev server's .next: dev would
  // then load the production runtime out of it and die with
  // "TypeError: e[o] is not a function". Set NEXT_DIST_DIR=.next-build for
  // throwaway builds (see `npm run build:check`); the real build is unaffected.
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
