/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base:     "#09090E",
        surface:  "#101016",
        elevated: "#15151C",
        dim:      "#1C1C2A",
        ink:      "#EDEDF2",
        muted:    "#808098",
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        sans:    ['"DM Sans"', "system-ui", "sans-serif"],
        mono:    ['"Space Mono"', "monospace"],
      },
      animation: {
        marquee:          "marquee 40s linear infinite",
        // marquee-smooth: two min-w-full children, speed controlled via --duration CSS var
        "marquee-smooth": "marquee-smooth var(--duration, 40s) linear infinite",
        "fade-up":        "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
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
      },
      boxShadow: {
        "indigo-ring": "0 0 0 1px rgba(99,102,241,0.25)",
      },
    },
  },
  plugins: [],
};
