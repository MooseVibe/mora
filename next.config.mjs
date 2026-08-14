/** @type {import('next').NextConfig} */
const imageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, stale-while-revalidate=604800',
  },
];

const prototypeCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, stale-while-revalidate=604800',
  },
];

const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/prototypes/spread-reading': ['./certs/russian_trusted_root_ca_pem.crt'],
    },
  },
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
      {
        source: '/assets/cards.js',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/prototypes/3d-daily/assets/:path*',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/prototypes/spread/app.js',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/prototypes/spread/daily-3d.js',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/prototypes/spread/spread-deck-3d.js',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/prototypes/spread/styles.css',
        headers: prototypeCacheHeaders,
      },
      {
        source: '/vendor/three/0.180.0/:path*',
        headers: prototypeCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
