import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

// Inline SVG icons for brands not in lucide-react v1 (brand icons were removed)
const GithubIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

// ─── Navigation groups ────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    title: "Explore",
    links: [
      { label: "Sandbox",      to: "/sandbox"      },
      { label: "Challenges",   to: "/challenges"   },
      { label: "Case Studies", to: "/case-studies" },
      { label: "Dashboard",    to: "/dashboard"    },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Core Concepts",     to: "/learn"         },
      { label: "Component Library", to: "/learn#components" },
      { label: "Interview Prep",    to: "/interview"     },
      { label: "Real Incidents",    to: "/case-studies"  },
      { label: "Scored Practice",   to: "/challenges"    },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "About",   to: "/" },
      { label: "GitHub",  href: "https://github.com" },
      { label: "Contact", href: "mailto:hello@systemsim.dev" },
    ],
  },
];

const SOCIAL = [
  { icon: GithubIcon,  label: "GitHub",  href: "https://github.com"         },
  { icon: Mail,        label: "Email",   href: "mailto:hello@systemsim.dev"  },
];

// ─── Footer ───────────────────────────────────────────────────────────────────

export default function Footer() {
  return (
    <footer className="relative w-full overflow-hidden pt-8 pb-8 px-4 sm:px-6 lg:px-8">

      {/* Ambient glow blobs — sit behind the glass container */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
        <div className="absolute -top-24 left-1/4  h-72 w-72 rounded-full bg-indigo-600/14 blur-3xl" />
        <div className="absolute right-1/4 -bottom-16 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      {/* ── Glass panel ──────────────────────────────────────────────────── */}
      <div
        className="relative z-10 mx-auto max-w-5xl rounded-2xl px-7 py-10 md:px-10 md:py-12"
        style={{
          background: "radial-gradient(ellipse 120% 100% at 30% 0%, rgba(99,102,241,0.07) 0%, rgba(13,13,30,0.92) 60%)",
          backdropFilter: "blur(20px) saturate(160%)",
          border: "1px solid rgba(99,102,241,0.14)",
          boxShadow: "0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">

          {/* ── Brand column ─────────────────────────────────────────────── */}
          <div className="md:col-span-1 flex flex-col items-center md:items-start gap-5">
            {/* Logo + wordmark */}
            <Link to="/" className="flex items-center gap-2.5 select-none group">
              <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.2)] group-hover:bg-white/16 transition-colors duration-200">
                <img src="/logo.png" alt="SystemSim" className="w-6 h-6 object-contain" />
              </span>
              <span className="font-display font-semibold text-base text-[#EDEDF2] tracking-tight">
                System<span className="text-indigo-400">Sim</span>
              </span>
            </Link>

            {/* Tagline */}
            <p className="text-[#808098] text-sm leading-relaxed text-center md:text-left max-w-[22ch]">
              Interactive distributed-systems learning. Design, simulate, understand.
            </p>

            {/* Social icons */}
            <ul className="flex items-center gap-3">
              {SOCIAL.map(({ icon: Icon, label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noreferrer"
                    className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#808098] hover:text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/25 transition-all duration-150"
                  >
                    <Icon size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Navigation columns ───────────────────────────────────────── */}
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-8">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="text-center sm:text-left">
                {/* Section heading */}
                <p className="font-display text-[0.6875rem] font-semibold tracking-[0.1em] uppercase text-indigo-400 mb-4">
                  {group.title}
                </p>
                <ul className="space-y-3">
                  {group.links.map(({ label, to, href }) => (
                    <li key={label}>
                      {to ? (
                        <Link
                          to={to}
                          className="font-sans text-sm text-[#808098] hover:text-[#EDEDF2] transition-colors duration-150"
                        >
                          {label}
                        </Link>
                      ) : (
                        <a
                          href={href}
                          target={href?.startsWith("http") ? "_blank" : undefined}
                          rel={href?.startsWith("http") ? "noreferrer" : undefined}
                          className="font-sans text-sm text-[#808098] hover:text-[#EDEDF2] transition-colors duration-150"
                        >
                          {label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────────── */}
        <div
          className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(99,102,241,0.12)" }}
        >
          <p className="font-sans text-xs text-[#808098]/70">
            &copy; {new Date().getFullYear()} SystemSim. All rights reserved.
          </p>
          <p className="font-mono text-[11px] text-[#808098]/40">
            Built for engineers who learn by doing.
          </p>
        </div>
      </div>
    </footer>
  );
}
