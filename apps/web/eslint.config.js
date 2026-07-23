import { mindmapNext } from '@mindmap/config'

export default [
  ...mindmapNext,
  {
    ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        console: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
]
