import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow the public IP of the VPS to hit the dev server.
  allowedDevOrigins: ['212.227.246.72', 'localhost', 'mindmap.azpy.es'],
  // Workspace packages ship TS source with .js import paths (ESM convention).
  // We let Next transpile them and add .ts/.tsx to Turbopack's resolve extensions
  // so `./client.js` correctly resolves to `./client.ts`.
  transpilePackages: [
    '@mindmap/auth',
    '@mindmap/brain',
    '@mindmap/config',
    '@mindmap/database',
    '@mindmap/parser',
    '@mindmap/prompts',
    '@mindmap/shared',
    '@mindmap/types',
    '@mindmap/ui',
    '@mindmap/analytics',
  ],
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css'],
    // next-intl 3.26.x sets the alias via experimental.turbo (Next ≤15).
    // For Next 16 + Turbopack we replicate it here so the runtime can find
    // the request config at the `next-intl/config` virtual module path.
    resolveAlias: {
      'next-intl/config': './src/i18n/request.ts',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
