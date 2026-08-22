import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        body: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        headline: ['var(--font-sora)', 'sans-serif'],
        // Papéis fixos — ver comentário em src/app/layout.tsx
        display: ['var(--font-display)', 'Arial Black', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        code: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        success: 'hsl(var(--success))',
        'text-body': 'hsl(var(--text-body))',
        'brand-dark': 'hsl(var(--brand-dark))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Aliases semânticos: use estes em código novo em vez de escalas
        // numéricas, para o raio do produto ficar num lugar só.
        card: 'var(--radius-card)',
        control: 'var(--radius-control)',
        // A escala numérica do Tailwind é reapertada para convergir no mesmo
        // raio. Isso puxa os ~1.800 usos de rounded-xl/2xl/3xl que já existem
        // nas telas sem precisar editar arquivo por arquivo.
        xl: 'var(--radius-control)',   // era 12px
        '2xl': 'var(--radius-card)',   // era 16px
        '3xl': 'var(--radius-card)',   // era 24px
      },
      boxShadow: {
        hard: 'var(--shadow-hard)',
        'hard-accent': 'var(--shadow-hard-accent)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'option-select': {
          '0%':   { boxShadow: '0 0 0 0 rgba(255, 107, 0, 0.3)' },
          '60%':  { boxShadow: '0 0 0 6px rgba(255, 107, 0, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(255, 107, 0, 0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'option-select': 'option-select 0.3s ease-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;