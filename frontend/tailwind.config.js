import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Safelist grid column classes for dynamic sections
    'grid-cols-2',
    'grid-cols-3',
    'grid-cols-4',
    'grid-cols-6',
    'grid-cols-8',
    'md:grid-cols-2',
    'md:grid-cols-3',
    'md:grid-cols-4',
    'md:grid-cols-6',
    'md:grid-cols-8',
    'lg:grid-cols-2',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'lg:grid-cols-6',
    'lg:grid-cols-8',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: 'var(--customer-primary, #236B34)',
          light: 'var(--customer-primary-light, #328745)',
          lighter: 'var(--customer-primary-lighter, #5FA82E)',
          dark: 'var(--customer-primary-dark, #1B5128)',
          darker: 'var(--customer-primary-darker, #14401F)',
        },
        brand: {
          green: 'var(--brand-green, #236B34)',
          'green-dark': 'var(--brand-green-dark, #1B5128)',
          'green-deep': 'var(--brand-green-deep, #14401F)',
          leaf: 'var(--brand-leaf, #5FA82E)',
          'leaf-light': 'var(--brand-leaf-light, #8CC63F)',
          'leaf-tint': 'var(--brand-leaf-tint, #EAF5E0)',
          orange: 'var(--brand-orange, #F97316)',
          'orange-deep': 'var(--brand-orange-deep, #E8590C)',
          amber: 'var(--brand-amber, #FFB020)',
          cream: 'var(--brand-cream, #FDF9F2)',
          'cream-soft': 'var(--brand-cream-soft, #F6EFE2)',
          ink: 'var(--brand-ink, #1C2B20)',
          'ink-muted': 'var(--brand-ink-muted, #5B6B60)',
          border: 'var(--brand-border, #E9E2D3)',
          'border-light': 'var(--brand-border-light, #F2ECE0)',
        },
        cream: {
          DEFAULT: '#FDF9F2',
          soft: '#F6EFE2',
        },
      },
      borderRadius: {
        'brand-card': '18px',
        'brand-input': '14px',
        'brand-btn': '12px',
      },
      boxShadow: {
        'brand-card': '0 6px 20px rgba(35, 107, 52, 0.07)',
        'brand-hover': '0 12px 28px rgba(35, 107, 52, 0.12)',
        'brand-pill': '0 4px 16px rgba(35, 107, 52, 0.25)',
      },
    },
  },
  plugins: [],
};
