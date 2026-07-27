import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100'

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['en', 'es']
  const now = new Date().toISOString()

  const routes = ['', '/sign-in']

  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const route of routes) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: now,
        changeFrequency: route === '' ? 'weekly' : 'monthly',
        priority: route === '' ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, `${BASE_URL}/${l}${route}`])),
        },
      })
    }
  }

  return entries
}
