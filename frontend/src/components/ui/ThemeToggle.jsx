import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// Small icon toggle for the two themes wired up in main.jsx (next-themes,
// attribute="class"). Mounted-guard avoids a hydration mismatch flash since
// `theme` is undefined on the very first client render.
export default function ThemeToggle({ className = "" }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span aria-hidden="true" className={`inline-block w-8 h-8 ${className}`} />;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`p-2 rounded-lg text-muted hover:text-ink hover:bg-hairline/[0.06] transition-colors duration-150 ${className}`}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
