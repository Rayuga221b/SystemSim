import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/store";

const LINKS = [
  { to: "/sandbox",      label: "Sandbox"      },
  { to: "/challenges",   label: "Challenges"   },
  { to: "/case-studies", label: "Case Studies" },
  { to: "/learn",        label: "Learn"        },
  { to: "/interview",    label: "Interview"    },
  { to: "/dashboard",    label: "Dashboard"    },
];

// ─── Navbar ───────────────────────────────────────────────────────────────────
//
// Design: floating pill that sits 12px below the top of the viewport.
//   • rounded-2xl with a soft indigo glow ring + backdrop blur
//   • Space Grotesk (font-display) for logo and nav labels
//   • Nav links: subtle background pill on hover, indigo-tinted bg when active
//   • Logo: white-tinted tile so the graph icon reads on dark bg
//   • Scroll-aware: glow intensifies slightly after 24px of scroll
//   • Mobile: animated height collapse via framer-motion

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
    /* Outer wrapper: sticky + padding creates the "floating" gap from the viewport edge */
    <div className="relative sticky top-0 z-50 px-4 sm:px-6 lg:px-8 pt-3 pb-2 pointer-events-none">
      {/* Full-width frosted strip: content scrolling under the navbar band blurs
          out instead of colliding with the floating pill. Masked so it fades
          at the bottom edge rather than cutting off hard. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 backdrop-blur-md bg-base/40
                   [mask-image:linear-gradient(to_bottom,black_62%,transparent)]"
      />
      <header
        className={`
          pointer-events-auto
          max-w-5xl mx-auto
          rounded-2xl
          border
          transition-all duration-300 ease-out
          ${scrolled
            ? [
                "bg-[#0E0E18]/92 backdrop-blur-2xl",
                "border-indigo-500/20",
                "shadow-[0_0_0_1px_rgba(99,102,241,0.18),0_8px_40px_rgba(0,0,0,0.65),0_0_80px_rgba(99,102,241,0.10),inset_0_1px_0_rgba(255,255,255,0.06)]",
              ].join(" ")
            : [
                "bg-[#0E0E18]/78 backdrop-blur-xl",
                "border-white/[0.08]",
                "shadow-[0_0_0_1px_rgba(99,102,241,0.10),0_4px_24px_rgba(0,0,0,0.50),0_0_50px_rgba(99,102,241,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]",
              ].join(" ")
          }
        `}
      >
        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="h-[52px] px-5 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 select-none group shrink-0">
            {/* Lit tile so the icon pops against the dark navbar */}
            <span className="w-7 h-7 rounded-lg bg-white/12 border border-white/22 flex items-center justify-center overflow-hidden shadow-[0_0_8px_rgba(99,102,241,0.2)] group-hover:bg-white/18 transition-colors duration-200">
              <img src="/logo.png" alt="SystemSim" className="w-[18px] h-[18px] object-contain" />
            </span>
            <span className="font-display font-semibold text-[0.9375rem] tracking-tight text-[#EDEDF2]">
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
                    "relative font-display text-[0.8125rem] px-3.5 py-1.5 rounded-xl font-medium",
                    "transition-all duration-150",
                    isActive
                      ? "text-[#EDEDF2] bg-indigo-500/12 border border-indigo-500/25 shadow-[inset_0_1px_0_rgba(99,102,241,0.15)]"
                      : "text-[#808098] hover:text-[#EDEDF2] border border-transparent hover:bg-white/[0.05]",
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
                  className="flex items-center gap-2 pl-1.5 pr-3.5 py-1 rounded-xl border border-white/[0.08] hover:bg-white/[0.05] transition-colors duration-150"
                  title={user.email}
                >
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/25 border border-indigo-500/40 flex items-center justify-center font-display text-[11px] font-semibold text-indigo-200 uppercase">
                    {user.email?.[0] || "u"}
                  </span>
                  <span className="font-display text-[0.8125rem] font-medium text-[#EDEDF2]">Workspace</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="font-display text-[0.8125rem] font-medium text-[#808098] hover:text-[#EDEDF2] px-4 py-1.5 rounded-xl transition-colors duration-150 hover:bg-white/[0.05]"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/sandbox"
                    className="font-display text-[0.8125rem] font-semibold text-white px-4 py-1.5 rounded-xl btn-primary shadow-[0_0_16px_rgba(99,102,241,0.3)]"
                  >
                    Try free
                  </Link>
                </>
              )}
            </div>
            <button
              type="button"
              className="md:hidden p-2 rounded-xl text-[#808098] hover:text-[#EDEDF2] hover:bg-white/[0.06] transition-colors duration-150"
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
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <nav aria-label="Mobile navigation" className="px-5 py-4 flex flex-col gap-1">
                {LINKS.map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      [
                        "font-display text-sm font-medium py-2.5 px-3 rounded-xl block transition-colors duration-150",
                        isActive
                          ? "text-[#EDEDF2] bg-indigo-500/12 border border-indigo-500/20"
                          : "text-[#808098] hover:text-[#EDEDF2] hover:bg-white/[0.05] border border-transparent",
                      ].join(" ")
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
              <div className="px-5 pb-5 pt-0 flex flex-col gap-2 border-t border-white/[0.04]">
                {user ? (
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="w-full text-center font-display text-sm font-medium text-[#EDEDF2] py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.05] transition-colors duration-150"
                  >
                    Your workspace
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-center font-display text-sm font-medium text-[#EDEDF2] py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.05] transition-colors duration-150"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/sandbox"
                      onClick={() => setMenuOpen(false)}
                      className="w-full text-center font-display text-sm font-semibold text-white py-2.5 rounded-xl btn-primary"
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
    </div>
  );
}
