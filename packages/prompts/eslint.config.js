import { mindmapBase } from '@mindmap/config'

export default [
  ...mindmapBase,
  {
    ignores: ['dist/**', '.turbo/**', 'prompts/**'],
  },
]
