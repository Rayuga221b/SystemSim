// Roadmap reader — documentation-style layout (MDN / GFG feel).
//
//   ┌────────────┬───────────────────────────────┐
//   │  sidebar   │  lesson body (font-read prose) │
//   │ modules →  │  + takeaways + interview angle │
//   │ lessons    │  + prev/next + sandbox CTA     │
//   └────────────┴───────────────────────────────┘
//
// Sidebar nav comes from /roadmap (all modules+lessons); the open lesson comes
// from /roadmap/:slug. Both fetched in parallel on slug change.
import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Clock, Menu, X, Check, ChevronDown, Lightbulb, Mic, PenTool,
} from "lucide-react";
import { api } from "@/api/client";
import Markdown from "@/components/ui/Markdown";

const READ_KEY = "systemsim_roadmap_read";
const loadRead = () => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]")); }
  catch { return new Set(); }
};

// ── Sidebar ──────────────────────────────────────────────────────────────────
// Each module is a collapsible dropdown so the nav isn't a wall of ~76 lessons.
// The module holding the active lesson opens by default; the rest stay collapsed.
function SidebarModule({ mod, activeSlug, onNavigate }) {
  const hasActive = mod.lessons.some((l) => l.slug === activeSlug);
  const [open, setOpen] = useState(hasActive);

  // Keep the active module open when the lesson changes (e.g. prev/next nav).
  useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);

  const panelId = `roadmap-mod-${mod.id}`;
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted/70 hover:text-ink mb-1 px-2 py-1.5 rounded-md hover:bg-hairline/[0.04] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: mod.color }} />
        <span className="min-w-0 truncate text-left flex-1">{mod.label}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-muted/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={panelId}
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden space-y-0.5"
          >
            {mod.lessons.map((l) => {
              const active = l.slug === activeSlug;
              return (
                <li key={l.slug}>
                  <Link
                    to={`/learn/roadmap/${l.slug}`}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.82rem] leading-snug transition-colors",
                      active
                        ? "bg-indigo-500/12 text-ink font-medium border border-indigo-500/25"
                        : "text-muted hover:text-ink hover:bg-hairline/[0.05] border border-transparent",
                    ].join(" ")}
                  >
                    <span
                      className="w-5 shrink-0 text-center font-mono text-[9.5px]"
                      style={{ color: active ? mod.color : undefined }}
                    >
                      {String(l.day).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 truncate">{l.title}</span>
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Sidebar({ overview, activeSlug, onNavigate }) {
  if (!overview) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(8)].map((_, i) => <div key={i} className="h-6 rounded bg-surface animate-pulse" />)}
      </div>
    );
  }
  return (
    <nav aria-label="Roadmap contents" className="py-6 px-4">
      <Link to="/learn/roadmap" className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted hover:text-ink uppercase tracking-wider mb-5 transition-colors">
        <ArrowLeft size={11} /> Roadmap overview
      </Link>
      {overview.modules.filter((m) => m.lesson_count > 0).map((mod) => (
        <SidebarModule key={mod.id} mod={mod} activeSlug={activeSlug} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

// ── On-this-page rail (from body H2s) ─────────────────────────────────────────
function OnThisPage({ body }) {
  const heads = useMemo(() => {
    return (body || "").split("\n")
      .filter((l) => /^##\s+/.test(l))
      .map((l) => {
        const text = l.replace(/^##\s+/, "").trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        return { text, id };
      });
  }, [body]);
  if (heads.length < 2) return null;
  return (
    <aside className="hidden xl:block sticky top-24 self-start w-52 shrink-0 pl-6">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted/50 mb-3">On this page</p>
      <ul className="space-y-2 border-l border-hairline/[0.08]">
        {heads.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="block -ml-px pl-3 border-l border-transparent hover:border-indigo-400 text-[0.78rem] text-muted hover:text-ink transition-colors leading-snug">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RoadmapLesson() {
  const { slug } = useParams();
  const [overview, setOverview] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [read, setRead] = useState(loadRead);

  // Sidebar nav is fetched once; lesson refetches per slug.
  useEffect(() => { api.getRoadmap().then(setOverview).catch(() => {}); }, []);

  useEffect(() => {
    setLesson(null);
    setError(null);
    setNavOpen(false);
    window.scrollTo({ top: 0 });
    api.getRoadmapLesson(slug).then(setLesson).catch((e) => setError(e.message));
  }, [slug]);

  // Opening a lesson marks it read.
  useEffect(() => {
    if (!lesson || read.has(lesson.slug)) return;
    const next = new Set(read).add(lesson.slug);
    setRead(next);
    localStorage.setItem(READ_KEY, JSON.stringify([...next]));
  }, [lesson]); // eslint-disable-line react-hooks/exhaustive-deps

  const color = lesson?.module_color || "#9B85FF";

  return (
    <div className="relative bg-base min-h-screen">
      <div className="max-w-[88rem] mx-auto flex">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:block w-72 shrink-0 border-r border-hairline/[0.06] h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          <Sidebar overview={overview} activeSlug={slug} />
        </aside>

        {/* ── Mobile sidebar toggle + drawer ── */}
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="lg:hidden fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-elevated border border-hairline/[0.12] shadow-lg shadow-black/40 px-4 py-2.5 font-display text-[13px] font-medium text-ink"
        >
          <Menu size={15} /> Contents
        </button>
        {navOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
            <div className="relative w-72 max-w-[80vw] bg-base border-r border-hairline/[0.1] h-full overflow-y-auto">
              <button type="button" onClick={() => setNavOpen(false)} className="absolute top-4 right-4 p-1.5 text-muted hover:text-ink" aria-label="Close">
                <X size={16} />
              </button>
              <Sidebar overview={overview} activeSlug={slug} onNavigate={() => setNavOpen(false)} />
            </div>
          </div>
        )}

        {/* ── Main column ── */}
        <div className="flex-1 min-w-0 flex justify-center">
          <main className="w-full max-w-3xl px-6 sm:px-10 py-10 sm:py-14">
            {error && <p className="text-red-400 text-sm">Couldn't load this lesson: {error}</p>}

            {!lesson && !error && (
              <div className="space-y-4">
                <div className="h-4 w-24 rounded bg-surface animate-pulse" />
                <div className="h-10 w-3/4 rounded bg-surface animate-pulse" />
                <div className="h-64 rounded-xl bg-surface animate-pulse mt-8" />
              </div>
            )}

            {lesson && (
              <motion.article
                key={lesson.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                  <span
                    className="font-mono text-[10px] font-semibold uppercase tracking-wider rounded-md px-2 py-1"
                    style={{ backgroundColor: `${color}1c`, color }}
                  >
                    Day {lesson.day}
                  </span>
                  <span className="font-mono text-[10px] text-muted/60 uppercase tracking-wider">{lesson.module_label}</span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-muted/50">
                    <Clock size={10} /> {lesson.reading_minutes} min read
                  </span>
                </div>

                <h1 className="font-display font-semibold text-ink text-[2rem] sm:text-[2.4rem] leading-[1.1] mb-3">
                  {lesson.title}
                </h1>
                {lesson.subtitle && (
                  <p className="font-read text-[1.15rem] text-muted leading-relaxed mb-8">{lesson.subtitle}</p>
                )}

                <div className="h-px bg-hairline/[0.08] mb-8" />

                {/* Body */}
                <Markdown>{lesson.body_md}</Markdown>

                {/* Key takeaways */}
                {lesson.key_takeaways?.length > 0 && (
                  <div className="mt-10 rounded-2xl border border-hairline/[0.08] bg-surface p-6">
                    <h2 className="flex items-center gap-2 font-display font-semibold text-ink text-[1.05rem] mb-4">
                      <Lightbulb size={16} style={{ color }} /> Key takeaways
                    </h2>
                    <ul className="space-y-2.5">
                      {lesson.key_takeaways.map((t, i) => (
                        <li key={i} className="flex gap-3 font-read text-[0.98rem] text-ink/85 leading-relaxed">
                          <Check size={16} className="mt-1 shrink-0" style={{ color }} />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interview angle */}
                {lesson.interview_angle && (
                  <div className="mt-5 rounded-2xl border-l-2 px-6 py-5" style={{ borderColor: color, backgroundColor: `${color}0f` }}>
                    <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] mb-2" style={{ color }}>
                      <Mic size={12} /> In an interview
                    </h2>
                    <p className="font-read text-[0.98rem] text-ink/85 leading-relaxed">{lesson.interview_angle}</p>
                  </div>
                )}

                {/* Sandbox CTA */}
                <Link
                  to="/sandbox"
                  className="group mt-6 flex items-center gap-4 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.06] px-6 py-5 hover:bg-indigo-500/[0.1] transition-colors"
                >
                  <span className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <PenTool size={17} className="text-indigo-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display font-semibold text-ink text-[0.98rem]">Now go build it</span>
                    <span className="block text-muted text-[0.84rem] mt-0.5">Open the sandbox and put this concept under load.</span>
                  </span>
                  <ArrowRight size={15} className="text-muted/40 group-hover:text-indigo-400 shrink-0 transition-colors" />
                </Link>

                {/* Prev / next */}
                <div className="mt-10 pt-6 border-t border-hairline/[0.06] grid grid-cols-2 gap-3">
                  {lesson.prev ? (
                    <Link to={`/learn/roadmap/${lesson.prev.slug}`} className="group flex flex-col gap-1 rounded-xl border border-hairline/[0.07] px-4 py-3 hover:border-hairline/[0.16] hover:bg-surface transition-colors">
                      <span className="flex items-center gap-1 font-mono text-[10px] text-muted/50 uppercase tracking-wider"><ArrowLeft size={11} /> Prev · Day {lesson.prev.day}</span>
                      <span className="font-display text-[0.86rem] text-ink font-medium truncate">{lesson.prev.title}</span>
                    </Link>
                  ) : <span />}
                  {lesson.next ? (
                    <Link to={`/learn/roadmap/${lesson.next.slug}`} className="group flex flex-col gap-1 items-end text-right rounded-xl border border-hairline/[0.07] px-4 py-3 hover:border-hairline/[0.16] hover:bg-surface transition-colors">
                      <span className="flex items-center gap-1 font-mono text-[10px] text-muted/50 uppercase tracking-wider">Next · Day {lesson.next.day} <ArrowRight size={11} /></span>
                      <span className="font-display text-[0.86rem] text-ink font-medium truncate w-full">{lesson.next.title}</span>
                    </Link>
                  ) : <span />}
                </div>

                {/* Attribution */}
                {lesson.attribution && (
                  <p className="mt-10 text-[0.7rem] text-muted/40 leading-relaxed">{lesson.attribution}</p>
                )}
              </motion.article>
            )}
          </main>

          {lesson && <OnThisPage body={lesson.body_md} />}
        </div>
      </div>
    </div>
  );
}
