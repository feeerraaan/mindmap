'use client'

/**
 * Inline script that runs before hydration to set the `dark` class on
 * <html> based on the cookie value (server-known) or the stored preference
 * in localStorage, falling back to the OS preference. Prevents theme flash.
 */
export function ThemeScript({ initialTheme }: { initialTheme: 'light' | 'dark' | 'system' }) {
  // The actual work is done in the inline <script>; this is just a hook for
  // future client-side theme persistence (e.g. cross-tab sync).
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var s=${JSON.stringify(initialTheme)};var p=localStorage.getItem('mindmap-theme');var t=p||s;var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}document.documentElement.setAttribute('data-theme', t);}catch(e){}})();`,
      }}
    />
  )
}
