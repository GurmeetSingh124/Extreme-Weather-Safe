/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* neutral, slightly blue-grey surfaces — the UI recedes, the map leads */
        ink: {
          950: '#070b14',
          900: '#0b1120',
          850: '#101827',
          800: '#151f31',
          750: '#1a2539',
          700: '#223049',
          600: '#2e3f5e',
          500: '#435878',
        },
        edge: 'rgba(148,176,224,0.14)',
        edge2: 'rgba(148,176,224,0.28)',
        line: 'rgba(148,176,224,0.20)',
        txt: { hi: '#eef3fb', mid: '#a8b8d2', lo: '#7b8ba6' },
        brand: { 300: '#8bdcff', 400: '#4dc4ff', 500: '#22a8f0', 600: '#0f86cc' },
        sev: {
          normal: '#22c55e',
          moderate: '#eab308',
          high: '#f97316',
          extreme: '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xs': ['0.5625rem', { lineHeight: '0.75rem' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(2,6,16,.5), 0 8px 24px -12px rgba(2,6,16,.8)',
        pop: '0 12px 40px -10px rgba(2,6,16,.9), 0 2px 6px rgba(2,6,16,.6)',
        focus: '0 0 0 3px rgba(77,196,255,.45)',
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      /* the design uses a few opacity steps that are not in Tailwind's default
         5%-step scale; without these `bg-ink-850/95`-style classes silently drop
         out of the build. Only the steps actually used are added, so the CSS
         does not grow by a whole 0-100 scale. */
      opacity: Object.fromEntries(
        [...new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 2, 6, 8, 12, 14, 16, 96, 97, 98])].map(
          (n) => [String(n), String(n / 100)]
        )
      ),
      backdropBlur: { xs: '2px' },
      animation: {
        'pulse-ring': 'pulseRing 2.6s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-up': 'fadeUp .26s ease-out both',
        'fade-in': 'fadeIn .2s ease-out both',
        'slide-in': 'slideIn .3s cubic-bezier(.22,1,.36,1) both',
        'sheet-up': 'sheetUp .28s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(.6)', opacity: '0.85' },
          '80%,100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        fadeUp: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'none' } },
        sheetUp: { from: { transform: 'translateY(16px)', opacity: '.4' }, to: { transform: 'none', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-500px 0' }, '100%': { backgroundPosition: '500px 0' } },
      },
    },
  },
  plugins: [],
};

