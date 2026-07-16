/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral chrome tokens are CSS-var-backed (see index.css :root /
        // .light) so light/dark mode repaints every `bg-base`, `text-ink`,
        // etc. usage app-wide with zero per-component edits. The
        // `rgb(var(--x) / <alpha-value>)` form keeps Tailwind's opacity
        // modifiers (bg-surface/50 etc.) working.
        base:     "rgb(var(--color-base) / <alpha-value>)",
        surface:  "rgb(var(--color-surface) / <alpha-value>)",
        elevated: "rgb(var(--color-elevated) / <alpha-value>)",
        dim:      "rgb(var(--color-dim) / <alpha-value>)",
        ink:      "rgb(var(--color-ink) / <alpha-value>)",
        muted:    "rgb(var(--color-muted) / <alpha-value>)",
        // Theme-flipping replacement for the old habit of using white/[alpha]
        // as a hairline border / hover wash on the dark bg: white in dark
        // mode, near-ink in light mode — same translucency, correct theme.
        hairline: "rgb(var(--color-hairline) / <alpha-value>)",
        // Second brand accent — "healthy / simulating" semantic only.
        // Never decorative; see DESIGN.md "Visual rebrand" note.
        mint:     "#34E2A1",
        // Full override of Tailwind's default indigo scale → violet.
        // Every `indigo-*` utility in the app (24 files) repaints to the
        // new brand accent for free — no per-file class renaming needed.
        indigo: {
          50:  "#F4F1FF",
          100: "#EAE3FF",
          // 200/300/400 are the light, washed-out steps of the scale — used
          // throughout as link/label/emphasis text (not just backgrounds).
          // On the dark bg they're comfortably light-on-dark; on a light bg
          // that same lightness reads as low-contrast lavender-on-white
          // (~1.5–2.8:1, fails WCAG AA). CSS-var-backed so `.light` can swap
          // in darker, readable steps from the same scale — every existing
          // `text-indigo-300` etc. usage (30+ call sites) repaints for free.
          200: "rgb(var(--color-indigo-200) / <alpha-value>)",
          300: "rgb(var(--color-indigo-300) / <alpha-value>)",
          400: "rgb(var(--color-indigo-400) / <alpha-value>)",
          500: "#7C5CFF",
          600: "#6A45F0",
          700: "#5935C9",
          800: "#4629A0",
          900: "#37217D",
          950: "#221454",
        },
        // Same problem, same fix, for the status-color scales used as text
        // (warning/bottleneck, healthy, info, error/failed) — Tailwind's
        // stock 300/400 steps are pastel-light, unreadable on a light bg.
        // Only the shades actually used as `text-*` need overriding; the
        // rest of each scale (backgrounds/borders) is untouched.
        amber: {
          300: "rgb(var(--color-amber-300) / <alpha-value>)",
          400: "rgb(var(--color-amber-400) / <alpha-value>)",
        },
        emerald: {
          300: "rgb(var(--color-emerald-300) / <alpha-value>)",
          400: "rgb(var(--color-emerald-400) / <alpha-value>)",
        },
        sky: {
          300: "rgb(var(--color-sky-300) / <alpha-value>)",
          400: "rgb(var(--color-sky-400) / <alpha-value>)",
        },
        red: {
          300: "rgb(var(--color-red-300) / <alpha-value>)",
          400: "rgb(var(--color-red-400) / <alpha-value>)",
          500: "rgb(var(--color-red-500) / <alpha-value>)",
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
