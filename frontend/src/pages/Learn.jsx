// The Library: core-concept chapters (the method) + the component library
// (the vocabulary). Theory always links back to the playground — read it,
// then go break something with it.
//
// Core concepts render as a compact, all-visible-at-once grid — clicking a
// card opens its content in a centered modal (blurred backdrop, gradient
// panel) instead of pushing the page into a long inline accordion.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2, Clock, ArrowRight, ChevronLeft, ChevronRight, X,
  BookOpen, Blocks, PenTool, Mic, Compass, Activity, Scale, TrendingUp, Map,
} from "lucide-react";
import { CHAPTERS } from "@/data/chapters";
import { CONCEPTS } from "@/data/concepts";
import { COMPONENTS, CATEGORIES } from "@/lib/components";
import { api } from "@/api/client";
import { useStore } from "@/store";
import Prose from "@/components/ui/Prose";
import PageGlow from "@/components/ui/PageGlow";
import LearnDrawer from "@/components/panels/LearnDrawer";

const READ_KEY = "systemsim_read_chapters";

function loadRead() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

// One icon + accent color per chapter — gives the grid visual variety instead
// of four identical rows, and doubles as the modal's gradient tint.
const CHAPTER_META = {
  "how-to-approach":      { icon: Compass,    color: "#9B85FF" },
  "reading-a-simulation": { icon: Activity,   color: "#38BDF8" },
  "tradeoff-profile":     { icon: Scale,      color: "#A78BFA" },
  "scaling-playbook":     { icon: TrendingUp, color: "#FBBF24" },
};

const EASE_EXPO = [0.16, 1, 0.3, 1];

function ChapterModal({ chapter, meta, index, total, onClose, onNav }) {
  const shouldReduce = useReducedMotion();
  const Icon = meta.icon;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < total - 1) onNav(1);
      if (e.key === "ArrowLeft" && index > 0) onNav(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onNav, index, total]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduce ? 0 : 0.2 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={chapter.title}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-hairline/[0.08] shadow-2xl shadow-black/60"
        style={{ background: `linear-gradient(160deg, ${meta.color}2e 0%, #0c0a1a 40%, #050508 100%)` }}
        initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.92, y: shouldReduce ? 0 : 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: shouldReduce ? 1 : 0.95, y: shouldReduce ? 0 : 10 }}
        transition={{ duration: shouldReduce ? 0 : 0.32, ease: EASE_EXPO }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-6 sm:px-7 py-5 border-b border-hairline/[0.08] backdrop-blur-md"
          style={{ background: `${meta.color}14` }}
        >
          <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}26` }}>
            <Icon size={18} style={{ color: meta.color }} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] mb-0.5" style={{ color: meta.color }}>
              Chapter {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </p>
            <h2 className="font-display font-semibold text-ink text-[1.1rem] leading-tight truncate">{chapter.title}</h2>
          </div>
          <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10.5px] text-muted/60 shrink-0">
            <Clock size={11} aria-hidden /> {chapter.minutes} min
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 p-1.5 -m-1.5 rounded text-muted hover:text-ink transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 sm:px-7 py-6">
          {chapter.sections.map((s, si) => (
            <div key={s.heading} className="mb-7 last:mb-0 pb-7 last:pb-0 border-b border-hairline/[0.06] last:border-0">
              <h3 className="flex items-baseline gap-2.5 font-display font-semibold text-[0.95rem] mb-2.5" style={{ color: meta.color }}>
                <span className="font-mono text-[11px]" aria-hidden>
                  {String(si + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h3>
              <Prose
                text={s.body}
                className="!text-[0.875rem] [&_strong]:text-indigo-200 [&_strong]:font-medium"
              />
              {s.takeaway && (
                <aside
                  className="mt-4 rounded-lg border-l-2 px-4 py-3"
                  style={{ borderColor: `${meta.color}b3`, backgroundColor: `${meta.color}12` }}
                >
                  <p className="font-mono text-[10px] tracking-[0.14em] uppercase mb-1" style={{ color: meta.color }}>
                    ★ Remember
                  </p>
                  <p className="font-read text-[0.9rem] text-ink leading-relaxed">{s.takeaway}</p>
                </aside>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 mt-1">
            <Link
              to="/sandbox"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-80 transition-opacity"
              style={{ color: meta.color }}
            >
              Apply it in the sandbox <ArrowRight size={13} />
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNav(-1)}
                disabled={index === 0}
                aria-label="Previous chapter"
                className="p-1.5 rounded-lg border border-hairline/[0.08] text-muted hover:text-ink hover:border-hairline/[0.16] disabled:opacity-25 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => onNav(1)}
                disabled={index === total - 1}
                aria-label="Next chapter"
                className="p-1.5 rounded-lg border border-hairline/[0.08] text-muted hover:text-ink hover:border-hairline/[0.16] disabled:opacity-25 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Featured roadmap block — a few preview days + a button into the full track
// (/learn/roadmap). Data comes from the DB-backed /roadmap endpoint; the block
// hides itself gracefully if the API is unreachable.
function RoadmapFeature() {
  const [data, setData] = useState(null);
  useEffect(() => { api.getRoadmap().then(setData).catch(() => setData(false)); }, []);
  if (data === false) return null;

  const preview = data?.modules.flatMap((m) =>
    m.lessons.map((l) => ({ ...l, color: m.color }))
  ).slice(0, 4);
  const first = preview?.[0];

  return (
    <section className="pt-10">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/25 p-6 sm:p-8"
           style={{ background: "linear-gradient(150deg, rgba(124,92,255,0.14) 0%, transparent 55%)" }}>
        <span aria-hidden className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl bg-indigo-500/15" />
        <div className="relative">
          <p className="flex items-center gap-2 font-mono text-[11px] text-indigo-400 tracking-[0.14em] uppercase mb-3">
            <Map size={13} /> Guided track
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display font-semibold text-ink text-[1.4rem] sm:text-[1.6rem] leading-tight mb-2">
                {data?.title || "The System Design Roadmap"}
              </h2>
              <p className="text-muted text-[0.9rem] max-w-[52ch] leading-relaxed">
                {data?.subtitle ||
                  "A sequenced path from first principles to production war stories — read in order, then apply in the sandbox."}
              </p>
            </div>
            <Link to="/learn/roadmap" className="btn-primary inline-flex items-center gap-2 text-white text-[13.5px] font-medium rounded-lg px-5 py-2.5 shrink-0 self-start">
              {data ? `Start the ${data.total_lessons}-lesson roadmap` : "Open the roadmap"}
              <ArrowRight size={14} />
            </Link>
          </div>

          {preview?.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {preview.map((l) => (
                <Link key={l.slug} to={`/learn/roadmap/${l.slug}`}
                      className="group flex items-center gap-3 rounded-xl border border-hairline/[0.07] bg-base/40 px-4 py-2.5 hover:border-hairline/[0.16] hover:bg-surface transition-colors">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-[10.5px] font-semibold"
                        style={{ backgroundColor: `${l.color}1c`, color: l.color }}>
                    {String(l.number).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 font-display text-[0.86rem] font-medium text-ink truncate">{l.title}</span>
                  <ArrowRight size={13} className="text-muted/30 group-hover:text-indigo-400 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          )}
          {first && (
            <p className="mt-4 text-[11px] font-mono text-muted/40 uppercase tracking-wider">
              Begins with Day {first.number} · {first.title}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Learn() {
  const [openSlug, setOpenSlug] = useState(null);
  const [read, setRead] = useState(loadRead);
  const openLearn = useStore((s) => s.openLearn);

  // Opening a chapter counts as reading it.
  useEffect(() => {
    if (!openSlug || read.has(openSlug)) return;
    const next = new Set(read).add(openSlug);
    setRead(next);
    localStorage.setItem(READ_KEY, JSON.stringify([...next]));
  }, [openSlug, read]);

  return (
    <div className="relative bg-base min-h-screen">
      <PageGlow blobs={[
        { x: "18%", y: "0%",  w: "55%", h: "65%", color: "rgba(124, 92, 255,0.16)" },
        { x: "88%", y: "8%",  w: "42%", h: "52%", color: "rgba(56,189,248,0.09)" },
      ]} />
      <div className="relative z-10 max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-hairline/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            The Library
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl mb-3 bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent">
                Learn
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                The method first, then the vocabulary. Everything here is written to be applied — read a chapter, then go break something with it in the sandbox.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">76</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Articles</p>
              </div>
              <div className="w-px h-9 bg-hairline/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-indigo-400 font-bold leading-none mb-1.5">{COMPONENTS.length}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Components</p>
              </div>
            </div>
          </div>
        </div>

        {/* Guided roadmap — the long-form sequential track */}
        <RoadmapFeature />

        {/* Core chapters */}
        <section className="pt-10">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-1">
            <BookOpen size={15} className="text-indigo-400" aria-hidden /> Core concepts
          </h2>
          <p className="text-muted text-[0.875rem] mb-5 max-w-[56ch]">
            Four short chapters covering the method behind every good design — and behind every number this simulator shows you.
          </p>

          {/* Compact grid — all four chapters visible without scrolling.
              Click opens the full content in a modal instead of expanding inline. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHAPTERS.map((ch, i) => {
              const meta = CHAPTER_META[ch.slug];
              const Icon = meta.icon;
              const isRead = read.has(ch.slug);
              return (
                <button
                  key={ch.slug}
                  type="button"
                  onClick={() => setOpenSlug(ch.slug)}
                  className="group relative text-left rounded-xl border p-5 flex flex-col gap-3 overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    borderColor: isRead ? `${meta.color}45` : "rgba(255,255,255,0.07)",
                    background: `linear-gradient(155deg, ${meta.color}12 0%, transparent 65%)`,
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-0 group-hover:opacity-25 transition-opacity duration-300"
                    style={{ background: meta.color }}
                  />
                  <span className="relative flex items-start justify-between">
                    <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1f` }}>
                      <Icon size={16} style={{ color: meta.color }} aria-hidden />
                    </span>
                    {isRead ? (
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-label="Read" />
                    ) : (
                      <span className="font-mono text-[10px] text-muted/40 shrink-0 mt-1.5">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className="relative block flex-1">
                    <span className="block font-display font-semibold text-ink text-[0.95rem] leading-snug">
                      {ch.title}
                    </span>
                    <span className="block text-muted text-[0.78rem] leading-relaxed mt-1.5 line-clamp-2">
                      {ch.summary}
                    </span>
                  </span>
                  <span className="relative flex items-center justify-between pt-3 border-t border-hairline/[0.05]">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted/50">
                      <Clock size={10} aria-hidden /> {ch.minutes} min
                    </span>
                    <span
                      className="text-[11.5px] font-medium flex items-center gap-1"
                      style={{ color: meta.color }}
                    >
                      Read
                      <ArrowRight size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <AnimatePresence>
          {openSlug && (() => {
            const openIndex = CHAPTERS.findIndex((c) => c.slug === openSlug);
            const chapter = CHAPTERS[openIndex];
            return (
              <ChapterModal
                chapter={chapter}
                meta={CHAPTER_META[openSlug]}
                index={openIndex}
                total={CHAPTERS.length}
                onClose={() => setOpenSlug(null)}
                onNav={(dir) => {
                  const next = CHAPTERS[openIndex + dir];
                  if (next) setOpenSlug(next.slug);
                }}
              />
            );
          })()}
        </AnimatePresence>

        {/* Interview prep link-card */}
        <section className="pt-10">
          <Link
            to="/learn/interview"
            className="group flex items-center gap-4 rounded-xl border border-dashed border-indigo-500/30 bg-surface px-6 py-5
                       hover:bg-elevated hover:border-indigo-500/50 transition-colors duration-150"
          >
            <span className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Mic size={17} className="text-indigo-400" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold text-ink text-[1.02rem]">Interview Prep</span>
              <span className="block text-muted text-[0.85rem] leading-relaxed mt-0.5">
                Turn what you've read into answers — practice saying the tradeoffs out loud.
              </span>
            </span>
            <ArrowRight size={15} className="text-muted/40 group-hover:text-indigo-400 shrink-0 transition-colors" aria-hidden />
          </Link>
        </section>

        {/* Component library */}
        <section className="pt-14" id="components">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-1">
            <Blocks size={15} className="text-indigo-400" aria-hidden /> Component library
          </h2>
          <p className="text-muted text-[0.875rem] mb-6 max-w-[56ch]">
            The 14 building blocks — what each one is, when to reach for it, who uses it in production, and how to talk about it in an interview.
          </p>

          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-8">
              <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-3">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
                {cat.label}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {COMPONENTS.filter((c) => c.category === cat.id).map((c) => {
                  const Icon = c.icon;
                  const hasConcept = !!CONCEPTS[c.type];
                  return (
                    <button
                      key={c.type}
                      type="button"
                      onClick={() => hasConcept && openLearn(c.type)}
                      className="group text-left bg-surface border border-hairline/[0.07] rounded-xl p-4 flex items-start gap-3
                                 hover:bg-elevated hover:border-hairline/[0.12] transition-colors duration-150"
                    >
                      <span
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${cat.color}1a` }}
                      >
                        <Icon size={16} style={{ color: cat.color }} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-medium text-ink">{c.label}</span>
                        <span className="block text-[12px] text-muted leading-snug mt-1 line-clamp-2">
                          {c.description}
                        </span>
                      </span>
                      <ArrowRight
                        size={13}
                        className="text-muted/40 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="mt-6 mb-24 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] p-6 sm:p-8">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-2">
            <PenTool size={16} className="text-indigo-400" aria-hidden /> Theory is half the loop
          </h2>
          <p className="text-[0.875rem] text-muted leading-relaxed mb-5 max-w-[58ch]">
            Reading about caches never taught anyone what a cache-miss spike feels like. Build something, put it under load, and watch the concepts turn into instincts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/sandbox" className="btn-primary inline-flex items-center gap-2 text-white text-[13.5px] font-medium rounded-lg px-5 py-2.5">
              Open the sandbox <ArrowRight size={14} />
            </Link>
            <Link
              to="/challenges"
              className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink border border-hairline/[0.1] rounded-lg px-5 py-2.5 hover:bg-elevated hover:border-indigo-500/35 transition-colors"
            >
              Take a scored challenge
            </Link>
          </div>
        </section>

      </div>

      {/* Component concept cards open in the same drawer the sandbox uses */}
      <LearnDrawer />
    </div>
  );
}
