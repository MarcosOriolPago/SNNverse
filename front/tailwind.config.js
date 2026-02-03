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
        yellow: {
          DEFAULT: '#fbbf24',
          light: '#facc15',
        },
        red: {
          DEFAULT: '#ef4444',
          light: '#f87171',
        },
        blue: {
          DEFAULT: '#3b82f6',
          light: '#60a5fa',
        },
        purple: {
          DEFAULT: '#a855f7',
          light: '#c084fc',
        },
        indigo: {
          DEFAULT: '#4f46e5',
          light: '#818cf8',
          lighter: '#a5b4fc',
        },
        orange: {
          DEFAULT: '#f59e0b',
        },

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
          100: '#f1f5f9',
          50: '#f8fafc',
        },

        // Semantic Colors
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

      // 2. Spacing Scale
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
      },

      // 4. Box Shadows
      boxShadow: {
        'xs': '0 1px 2px rgba(0, 0, 0, 0.1)',
        'sm': '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        '3xl': '0 20px 60px rgba(0, 0, 0, 0.5)',

        // Glow shadows
        'glow-primary': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-primary-strong': '0 0 40px rgba(139, 92, 246, 0.5)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-cyan-strong': '0 0 30px rgba(34, 211, 238, 0.5)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-green': '0 0 8px rgba(34, 197, 94, 0.9)',

        // Inset shadows
        'inset-sm': 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
        'inset-md': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',

        // Combined shadows
        'card': '0 20px 40px rgba(0, 0, 0, 0.75)',
        'card-hover': '0 20px 40px rgba(167, 139, 250, 0.3)',
        'button-primary': '0 4px 12px rgba(139, 92, 246, 0.3)',
        'button-primary-hover': '0 6px 20px rgba(139, 92, 246, 0.4)',
      },

      // 5. Gradients
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'gradient-accent': 'linear-gradient(135deg, #a78bfa 0%, #ec4899 100%)',
        'gradient-rainbow': 'linear-gradient(135deg, #a78bfa 0%, #ec4899 50%, #f59e0b 100%)',
        'gradient-rainbow-text': 'linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)',
        'gradient-blue-purple': 'linear-gradient(to bottom right, #3b82f6, #a855f7)',
        'gradient-blue-purple-pink': 'linear-gradient(to right, #3b82f6, #a855f7, #ec4899)',

        'gradient-bg-primary': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        'gradient-bg-card': 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98))',
        'gradient-bg-glass': 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
        'gradient-bg-button-secondary': 'linear-gradient(135deg, rgba(51, 65, 85, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)',
        'gradient-bg-button-secondary-hover': 'linear-gradient(135deg, rgba(71, 85, 105, 0.9) 0%, rgba(51, 65, 85, 0.9) 100%)',

        'gradient-accent-primary-subtle': 'linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(236, 72, 153, 0.2))',
        'gradient-accent-primary-subtle-hover': 'linear-gradient(135deg, rgba(167, 139, 250, 0.3), rgba(236, 72, 153, 0.3))',
        'gradient-primary-glow': 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%)',
        'gradient-primary-glow-reverse': 'linear-gradient(0deg, rgba(139, 92, 246, 0.03) 0%, transparent 100%)',
      },

      // 6. Typography
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        'xs': '0.625rem',
        'sm': '0.75rem',
        'base': '0.875rem',
        'md': '0.9rem',
        'lg': '1rem',
        'xl': '1.125rem',
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
      },

      // 8. Transitions
      transitionProperty: {
        'smooth': 'all', // custom needs
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        'fast': '0.15s',
        'normal': '0.2s',
        'slow': '0.3s',
      },

      // 9. Backdrop Blur
      backdropBlur: {
        'sm': '4px',
        'md': '6px',
        'lg': '10px',
        'xl': '24px',
      }
    },
  },
  plugins: [],
}