import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#FBF9F5', // Canvas warm white
          lowest: '#FFFFFF',  // Card background
          low: '#F5F3EF',     // Secondary card / search container
          container: '#EFEEEA', // Inactive pill / table badge
          high: '#EAE8E4',    // Disabled / Sold out
        },
        'on-surface': {
          DEFAULT: '#1B1C1A', // Charcoal espresso headings / main text
          variant: '#544339', // Muted brown descriptions
        },
        primary: {
          DEFAULT: '#924805', // Terracotta amber
          container: '#B05F20', // Hover / focus
          fixed: '#FFDCC7',   // Selected quiz chip bg
          'on-fixed': '#311300', // Selected quiz chip text
        },
        'on-primary': '#FFFFFF',
        'inverse-surface': {
          DEFAULT: '#241E1B', // Dark roast dock / stepper / KDS
          foreground: '#FBF9F5',
        },
        'outline-variant': '#E7E2DA', // Hairline border 1px
        outline: '#877367', // Interactive border
        status: {
          paid: '#1E7E34',    // Success green
          cooking: '#D97706', // Warning amber
          error: '#BA1A1A',   // Danger / Sold out red
          pending: '#766F66', // Muted gray
        },
        // Aliases for seamless backward compatibility
        brand: {
          DEFAULT: '#1B1C1A',
          espresso: '#1B1C1A',
          dark: '#241E1B',
        },
        accent: {
          DEFAULT: '#924805',
          hover: '#B05F20',
          light: '#FFDCC7',
        },
        cream: {
          DEFAULT: '#FBF9F5',
          darker: '#F5F3EF',
        },
        sand: {
          50: '#FDFBF7',
          100: '#F7F4EE',
          200: '#EFEAE0',
          300: '#E3DCCE',
          400: '#C8BEAF',
          800: '#2A2621',
          900: '#1A1815',
        },
        charcoal: {
          950: '#111110',
          900: '#181816',
          850: '#20201E',
          800: '#2B2B28',
          700: '#3D3D39',
        },
        terracotta: {
          DEFAULT: '#924805',
          dark: '#7A3B04',
          500: '#C25E2B',
          600: '#A94E20',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['var(--font-serif)', '"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      minHeight: {
        touch: '44px',
        'touch-kds': '56px',
      },
      minWidth: {
        touch: '44px',
        'touch-kds': '56px',
      },
      transitionTimingFunction: {
        sela: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        tap: '120ms',
        sheet: '280ms',
        page: '180ms',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        level1: '0 1px 3px rgba(36, 30, 27, 0.03)',
        level2: '0 8px 24px rgba(36, 30, 27, 0.06)',
        level3: '0 -12px 32px rgba(36, 30, 27, 0.12)',
        subtle: '0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.03)',
        frame: '0 0 0 1px rgba(27, 24, 21, 0.08), 0 12px 36px -8px rgba(27, 24, 21, 0.06)',
        card: '0 0 0 1px rgba(27, 24, 21, 0.06), 0 8px 24px -4px rgba(27, 24, 21, 0.04)',
        glow: '0 0 60px -12px rgba(194, 94, 43, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
