/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Adjust this path to match your file structure
  ],
  theme: {
    extend: {
      // 1. Color Palette (Direct mapping from variables.css)
      colors: {
        // Primary & Accent
        primary: {
          DEFAULT: '#8b5cf6', // --color-primary
          light: '#a78bfa',   // --color-primary-light
          dark: '#7c3aed',    // --color-primary-dark
          darker: '#6d28d9',  // --color-primary-darker
        },
        accent: {
          DEFAULT: '#ec4899', // --color-accent
          light: '#f472b6',   // --color-accent-light
        },

        // Functional Colors
        cyan: {
          DEFAULT: '#22d3ee',
          light: '#38bdf8',
          dark: '#0891b2',
        },
        green: {
          DEFAULT: '#22c55e',
          light: '#4ade80',
          dark: '#16a34a',
        },
        // ... (You can add the other standard colors like red, blue, etc. 
        // Tailwind actually provides these by default, but you can override 
        // if you want your exact hex codes).

        // Custom Slate (Backgrounds)
        slate: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          50: '#f8fafc',
        },

        // Semantic Colors (The "Magic" Layer)
        // This allows you to use class="bg-primary" or class="text-muted"
        bg: {
          primary: '#020617',      // var(--color-bg-primary)
          secondary: '#0f172a',    // var(--color-bg-secondary)
          tertiary: '#1e293b',     // var(--color-bg-tertiary)
          elevated: '#111827',     // var(--color-bg-elevated)
          overlay: 'rgba(0, 0, 0, 0.75)',
        },
        text: {
          primary: '#ffffff',      // var(--color-text-primary)
          secondary: '#cbd5e1',    // var(--color-text-secondary)
          muted: '#94a3b8',        // var(--color-text-muted)
          disabled: '#64748b',     // var(--color-text-disabled)
          subtle: '#475569',       // var(--color-text-subtle)
        },
        border: {
          primary: '#1e293b',      // var(--color-border-primary)
          secondary: '#334155',    // var(--color-border-secondary)
          muted: 'rgba(148, 163, 184, 0.2)',
          focus: '#8b5cf6',
        }
      },

      // 2. Spacing Scale (Removes need for utilities.css)
      spacing: {
        'xs': '0.25rem',  // gap-xs, p-xs
        'sm': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        '4xl': '3rem',
      },

      // 3. Border Radius
      borderRadius: {
        'sm': '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        // 'full' is included by default
      },

      // 4. Box Shadows
      boxShadow: {
        'glow-primary': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'card': '0 20px 40px rgba(0, 0, 0, 0.75)',
        'card-hover': '0 20px 40px rgba(167, 139, 250, 0.3)',
        // Tailwind includes sm, md, lg, xl, 2xl by default
      },

      // 5. Gradients
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'gradient-accent': 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        'gradient-rainbow': 'linear-gradient(135deg, #a78bfa 0%, #ec4899 50%, #f59e0b 100%)',
        'gradient-rainbow-text': 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
        'gradient-bg-primary': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        'gradient-bg-glass': 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
      },

      // 6. Typography
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        // Tailwind default scale is very similar, but you can enforce yours here
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },

      // 7. Z-Index
      zIndex: {
        dropdown: '10',
        popup: '50',
        modal: '1000',
      }
    },
  },
  plugins: [],
}