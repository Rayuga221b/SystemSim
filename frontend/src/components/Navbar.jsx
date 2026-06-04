import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";

const LINKS = [
  { to: "/sandbox",      label: "Sandbox" },
  { to: "/challenges",   label: "Challenges" },
  { to: "/case-studies", label: "Case Studies" },
  { to: "/dashboard",    label: "Dashboard" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onScroll = () => setScrolled(window.scrollY > 8);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-white/[0.05] transition-colors duration-200 ${
        scrolled ? "bg-base/90 backdrop-blur-md" : "bg-base"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo + desktop nav */}
        <div className="flex items-center gap-7">
          <Link to="/" className="flex items-center gap-2 select-none group">
            <img
              src="/logo.png"
              alt="SystemSim logo"
              className="w-6 h-6 object-contain"
            />
            <span className="font-semibold text-sm text-ink tracking-tight">SystemSim</span>
          </Link>

          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm px-3 py-1.5 rounded-md font-medium transition-colors duration-150 ${
                    isActive
                      ? "text-ink bg-elevated"
                      : "text-muted hover:text-ink hover:bg-elevated/60"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Auth + mobile toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              className="text-sm font-medium text-muted hover:text-ink px-4 py-2 rounded-md transition-colors duration-150"
            >
              Sign in
            </button>
            <button
              type="button"
              className="text-sm font-medium text-white px-4 py-2 rounded-md btn-primary"
            >
              Try free
            </button>
          </div>

          <button
            type="button"
            className="md:hidden p-2 rounded-md text-muted hover:text-ink hover:bg-elevated transition-colors duration-150"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-white/[0.05] bg-base px-6 py-4">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-0.5">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `text-sm font-medium py-2.5 px-3 rounded-md block transition-colors duration-150 ${
                    isActive ? "text-ink bg-elevated" : "text-muted hover:text-ink hover:bg-elevated/50"
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-col gap-2">
            <button
              type="button"
              className="w-full text-sm font-medium text-ink py-2.5 rounded-md border border-white/[0.08] hover:bg-elevated transition-colors duration-150"
            >
              Sign in
            </button>
            <button
              type="button"
              className="w-full text-sm font-medium text-white py-2.5 rounded-md btn-primary"
            >
              Try free
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
