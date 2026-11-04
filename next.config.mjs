/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { formats: ['image/webp'], minimumCacheTTL: 2592000, deviceSizes: [390, 640, 828, 1080, 1440, 1920], imageSizes: [96, 160, 256, 384] },
  experimental: {
    // Going back to a screen you just saw is instant.
    staleTimes: { dynamic: 60, static: 600 },
  },
  // The app opens on Home. Logging in is optional until someone books.
  async redirects() {
    return [{ source: '/', destination: '/home', permanent: false }];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(self), microphone=()' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      { source: '/img/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    ];
  },
};

export default nextConfig;
