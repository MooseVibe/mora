/** @type {import('next').NextConfig} */
const imageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, stale-while-revalidate=604800',
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/assets/cards/:path*',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/day-deck-scene-bg.webp',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/day-panel-bg.webp',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/mora-door.webp',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/fonts/:path*',
        headers: imageCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
