import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MindMap — An MRI scan for knowledge',
    short_name: 'MindMap',
    description: 'Discover what you truly know. Calm, honest, diagnostic.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0e1218',
    theme_color: '#1f8e9e',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['education', 'productivity'],
    lang: 'en',
  }
}
