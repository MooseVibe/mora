/** @type {import('next').NextConfig} */
const imageCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=86400, stale-while-revalidate=604800',
  },
];

const staticCacheHeaders = [
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
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/',
          destination: '/welcome/index.html',
        },
        {
          source: '/ritual',
          destination: '/ritual/index.html',
        },
        {
          source: '/privacy',
          destination: '/legal/privacy.html',
        },
        {
          source: '/terms',
          destination: '/legal/terms.html',
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: '/assets/cards/:path*',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/fonts/:path*',
        headers: imageCacheHeaders,
      },
      {
        source: '/assets/cards.js',
        headers: staticCacheHeaders,
      },
      {
        source: '/assets/3d/:path*',
        headers: staticCacheHeaders,
      },
      {
        source: '/ritual/app.js',
        headers: staticCacheHeaders,
      },
      {
        source: '/ritual/daily-3d.js',
        headers: staticCacheHeaders,
      },
      {
        source: '/ritual/spread-deck-3d.js',
        headers: staticCacheHeaders,
      },
      {
        source: '/ritual/styles.css',
        headers: staticCacheHeaders,
      },
      {
        source: '/ritual/icons/:path*',
        headers: staticCacheHeaders,
      },
      {
        source: '/vendor/three/0.180.0/:path*',
        headers: staticCacheHeaders,
      },
    ];
  },
};

export default nextConfig;
