/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base:     "#0B0E14",
        surface:  "#12161F",
        elevated: "#1A2030",
        dim:      "#262E42",
        ink:      "#F3F5FA",
        muted:    "#8D97B0",
        // Second brand accent — "healthy / simulating" semantic only.
        // Never decorative; see DESIGN.md "Visual rebrand" note.
        mint:     "#34E2A1",
        // Full override of Tailwind's default indigo scale → violet.
        // Every `indigo-*` utility in the app (24 files) repaints to the
        // new brand accent for free — no per-file class renaming needed.
        indigo: {
          50:  "#F4F1FF",
          100: "#EAE3FF",
          200: "#D6C9FF",
          300: "#B6A6FF",
          400: "#9B85FF",
          500: "#7C5CFF",
          600: "#6A45F0",
          700: "#5935C9",
          800: "#4629A0",
          900: "#37217D",
          950: "#221454",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans:    ['"DM Sans"', "system-ui", "sans-serif"],
        mono:    ['"Space Mono"', "monospace"],
        // Long-form reading only (case-study prose, learn articles) — a
        // serif gives dense paragraphs a distinct rhythm from UI chrome so
        // "read this" and "click this" never look the same. Never used for
        // headings, labels, or controls. See DESIGN.md "Visual rebrand".
        read:    ['"Source Serif 4"', "Georgia", "serif"],
      },
      animation: {
        marquee:          "marquee 40s linear infinite",
        // marquee-smooth: two min-w-full children, speed controlled via --duration CSS var
        "marquee-smooth": "marquee-smooth var(--duration, 40s) linear infinite",
        "fade-up":        "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "logo-pulse":     "logoPulse 2.4s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Center node of the Logo mark — a small, quiet "always simulating" cue.
        logoPulse: {
          "0%, 100%": { transform: "scale(1)",    opacity: "1"    },
          "50%":      { transform: "scale(1.12)", opacity: "0.85" },
        },
      },
      boxShadow: {
        "indigo-ring": "0 0 0 1px rgba(124,92,255,0.25)",
      },
    },
  },
  plugins: [],
};
