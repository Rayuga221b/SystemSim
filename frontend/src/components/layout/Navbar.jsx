import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store";
import Logo from "@/components/ui/Logo";

// Learn sits before Sandbox (2026-07-16): the library is the entry point.
// Interview prep moved under /learn/interview and is reached from the Learn
// page's link-card, so it's no longer a top-level nav item.
const LINKS = [
  { to: "/learn",        label: "Learn"        },
  { to: "/sandbox",      label: "Sandbox"      },
  { to: "/challenges",   label: "Challenges"   },
  { to: "/case-studies", label: "Case Studies" },
  { to: "/dashboard",    label: "Dashboard"    },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────
//
// Design (2026-07-08 rebrand): full-width sticky bar, not a floating pill —
// same treatment as the case-study mockup's topnav. Fonts are untouched
// (Space Grotesk / font-display for logo + nav labels); only the shape,
// chrome, and motion changed:
//   • flat bar, thin bottom border, backdrop blur — no rounded pill, no glow
//   • Logo: inline SVG mark (src/components/ui/Logo.jsx), center node pulses
//   • Nav links: violet-tinted pill when active (via the indigo→violet token
//     remap in tailwind.config.js), plain hover otherwise
//   • Border/blur intensify slightly after 24px of scroll — same idea as
//     before, just applied to a flat bar instead of a glowing pill
//   • Mobile: animated height collapse via framer-motion (unchanged)

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const user = useStore((s) => s.user);

  useEffect(() => {
    const onKey    = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onScroll = () => setScrolled(window.scrollY > 24);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ease-out border-b
        ${scrolled
          ? "bg-base/90 backdrop-blur-2xl border-indigo-500/15"
          : "bg-base/60 backdrop-blur-xl border-hairline/[0.06]"
        }`}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto h-14 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 select-none group shrink-0">
          <Logo size={20} pulse className="transition-transform duration-200 group-hover:scale-105" />
          <span className="font-display font-semibold text-[0.9375rem] tracking-tight text-ink">
            System<span className="text-indigo-400">Sim</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0.5">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "relative font-display text-[0.8125rem] px-3.5 py-1.5 rounded-lg font-medium",
                  "transition-all duration-150",
                  isActive
                    ? "text-ink bg-indigo-500/12 border border-indigo-500/25"
                    : "text-muted hover:text-ink border border-transparent hover:bg-hairline/[0.05]",
                ].join(" ")
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Auth + mobile toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Link
                to="/dashboard"
                className="flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-lg border border-hairline/[0.08] hover:bg-hairline/[0.05] transition-colors duration-150"
                title={user.email}
              >
                <span className="w-6 h-6 rounded-lg bg-indigo-500/25 border border-indigo-500/40 flex items-center justify-center font-display text-[11px] font-semibold text-indigo-200 uppercase">
                  {user.email?.[0] || "u"}
                </span>
                <span className="font-display text-[0.8125rem] font-medium text-ink">Workspace</span>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="font-display text-[0.8125rem] font-medium text-muted hover:text-ink px-4 py-1.5 rounded-lg transition-colors duration-150 hover:bg-hairline/[0.05]"
                >
                  Sign in
                </Link>
                <Link
                  to="/sandbox"
                  className="font-display text-[0.8125rem] font-semibold text-white px-4 py-1.5 rounded-lg btn-primary"
                >
                  Try free
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-muted hover:text-ink hover:bg-hairline/[0.06] transition-colors duration-150"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-hairline/[0.06] bg-base/95 backdrop-blur-xl"
          >
            <nav aria-label="Mobile navigation" className="px-5 py-4 flex flex-col gap-1">
              {LINKS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    [
                      "font-display text-sm font-medium py-2.5 px-3 rounded-lg block transition-colors duration-150",
                      isActive
                        ? "text-ink bg-indigo-500/12 border border-indigo-500/20"
                        : "text-muted hover:text-ink hover:bg-hairline/[0.05] border border-transparent",
                    ].join(" ")
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="px-5 pb-5 pt-0 flex flex-col gap-2 border-t border-hairline/[0.04]">
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="w-full text-center font-display text-sm font-medium text-ink py-2.5 rounded-lg border border-hairline/[0.08] hover:bg-hairline/[0.05] transition-colors duration-150"
                >
                  Your workspace
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-center font-display text-sm font-medium text-ink py-2.5 rounded-lg border border-hairline/[0.08] hover:bg-hairline/[0.05] transition-colors duration-150"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/sandbox"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-center font-display text-sm font-semibold text-white py-2.5 rounded-lg btn-primary"
                  >
                    Try free
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
