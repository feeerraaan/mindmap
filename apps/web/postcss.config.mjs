/**
 * PostCSS config - Tailwind v4.
 *
 * Tailwind v4 ships as a PostCSS plugin; the official @tailwindcss/postcss
 * package handles the processing. The CSS that gets processed is the one
 * imported in apps/web/src/app/[locale]/layout.tsx → @mindmap/ui/styles.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
