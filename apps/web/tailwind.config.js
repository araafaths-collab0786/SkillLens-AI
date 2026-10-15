/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/shared/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Design tokens mapped to Tailwind utilities ─────────────────────────
      colors: {
        // Approved tokens
        "white-mist": "#F3F6F8",
        "deep-navy": "#0B1F3A",
        "cyan": "#06B6D4",
        // APPROVED 2025-07-11 (Gate 2) — links, small accent text, focus rings on White Mist
        "cyan-text": "#0E7490",  // APPROVED Gate 2 2025-07-11
      },
      fontFamily: {
        sans: ['-apple-system', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: "12px",
        lg: "8px",
        md: "6px",
      },
      // ── Responsive breakpoints (mobile-first) ─────────────────────────────
      // Tailwind defaults: sm=640, md=768, lg=1024, xl=1280 — aligned with spec
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      spacing: {
        // 8px grid — multiples of 2 already cover this in Tailwind default
        // Custom values for safe-area insets
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)",
      },
      transitionDuration: {
        "200": "200ms",
        "300": "300ms",
      },
      transitionTimingFunction: {
        "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "counter": {
          "0%": { "--value": "0" },
          "100%": { "--value": "var(--target)" },
        },
      },
      animation: {
        "fade-up": "fade-up 300ms ease-out both",
      },
    },
  },
  plugins: [],
};
