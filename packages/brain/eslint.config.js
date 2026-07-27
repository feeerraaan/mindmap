import { mindmapBase } from '@mindmap/config'

export default [
  ...mindmapBase,
  {
    ignores: ['dist/**', '.turbo/**', 'node_modules/**'],
  },
  {
    // The brain IS the package that is allowed to import AI SDKs.
    // docs/architecture.md §6.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]
