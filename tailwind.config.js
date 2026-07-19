/** @type {import('tailwindcss').Config} */

/** Build a full 50–950 scale from CSS variables. */
function cssScale(prefix) {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  /** @type {Record<string, string>} */
  const out = {}
  for (const s of steps) {
    out[s] = `rgb(var(--${prefix}-${s}) / <alpha-value>)`
  }
  return out
}

module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[class~="theme-dark"]'],
  theme: {
    extend: {
      colors: {
        brand: cssScale('brand'),
        ink: cssScale('ink'),
        emerald: cssScale('emerald'),
        amber: cssScale('amber'),
        rose: cssScale('rose'),
        /** Theme-aware (inverted in light) — group badges, caps */
        sky: cssScale('sky'),
        violet: cssScale('violet'),
        /** Theme-aware dimmer for modals */
        overlay: 'rgb(var(--overlay) / <alpha-value>)'
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          'Noto Sans TC',
          'system-ui',
          '-apple-system',
          'sans-serif'
        ]
      },
      boxShadow: {
        'theme-sm':
          '0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 1px 3px rgb(var(--shadow-rgb) / 0.08)',
        'theme-md':
          '0 4px 12px rgb(var(--shadow-rgb) / 0.1), 0 2px 4px rgb(var(--shadow-rgb) / 0.06)'
      }
    }
  },
  plugins: []
}
