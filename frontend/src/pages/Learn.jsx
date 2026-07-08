// The Library: core-concept chapters (the method) + the component library
// (the vocabulary). Theory always links back to the playground — read it,
// then go break something with it.
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, CheckCircle2, Clock, ArrowRight, BookOpen, Blocks, PenTool, Mic,
} from "lucide-react";
import { CHAPTERS } from "@/data/chapters";
import { CONCEPTS } from "@/data/concepts";
import { COMPONENTS, CATEGORIES } from "@/lib/components";
import { useStore } from "@/store";
import Prose from "@/components/ui/Prose";
import LearnDrawer from "@/components/panels/LearnDrawer";

const READ_KEY = "systemsim_read_chapters";

function loadRead() {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || "[]"));
  } catch {
    return new Set();
  }
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
    <div className="bg-base min-h-screen">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-white/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            The Library
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl text-ink mb-3">
                Learn
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                The method first, then the vocabulary. Everything here is written to be applied — read a chapter, then go break something with it in the sandbox.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">
                  {read.size}<span className="text-muted text-lg">/{CHAPTERS.length}</span>
                </p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Chapters read</p>
              </div>
              <div className="w-px h-9 bg-white/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-indigo-400 font-bold leading-none mb-1.5">{COMPONENTS.length}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Components</p>
              </div>
            </div>
          </div>
        </div>

        {/* Core chapters */}
        <section className="pt-10">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-1">
            <BookOpen size={15} className="text-indigo-400" aria-hidden /> Core concepts
          </h2>
          <p className="text-muted text-[0.875rem] mb-5 max-w-[56ch]">
            Four short chapters covering the method behind every good design — and behind every number this simulator shows you.
          </p>

          <div className="flex flex-col gap-3">
            {CHAPTERS.map((ch, i) => {
              const isOpen = openSlug === ch.slug;
              const isRead = read.has(ch.slug);
              return (
                <article
                  key={ch.slug}
                  className={`relative bg-surface border rounded-xl transition-colors duration-200 ${
                    isOpen ? "border-indigo-500/30" : "border-white/[0.07] hover:border-white/[0.12]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenSlug(isOpen ? null : ch.slug)}
                    aria-expanded={isOpen}
                    className="w-full text-left p-6 flex items-start gap-4"
                  >
                    <span className="font-mono text-[11px] text-indigo-400/80 mt-1 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-display font-semibold text-ink text-[1.05rem] leading-snug">
                          {ch.title}
                        </span>
                        {isRead && (
                          <CheckCircle2 size={14} className="text-emerald-400 shrink-0" aria-label="Read" />
                        )}
                      </span>
                      <span className="block text-muted text-[0.875rem] leading-relaxed mt-1.5 max-w-[62ch]">
                        {ch.summary}
                      </span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0 mt-1">
                      <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted/45">
                        <Clock size={10} aria-hidden /> {ch.minutes} min
                      </span>
                      <ChevronDown
                        size={15}
                        className={`text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pl-[3.25rem] border-t border-white/[0.05] pt-5">
                      {ch.sections.map((s, si) => (
                        <div
                          key={s.heading}
                          className="mb-7 last:mb-0 pb-7 last:pb-0 border-b border-white/[0.04] last:border-0"
                        >
                          <h3 className="flex items-baseline gap-2.5 font-display font-semibold text-ink text-[0.9375rem] mb-2.5">
                            <span className="font-mono text-[11px] text-indigo-400/80" aria-hidden>
                              {String(si + 1).padStart(2, "0")}
                            </span>
                            {s.heading}
                          </h3>
                          <Prose
                            text={s.body}
                            className="!text-[0.9rem] max-w-[60ch] [&_strong]:text-indigo-200 [&_strong]:font-medium"
                          />
                          {s.takeaway && (
                            <aside className="mt-4 rounded-lg border-l-2 border-indigo-500/70 bg-indigo-500/[0.06] px-4 py-3 max-w-[60ch]">
                              <p className="font-mono text-[10px] text-indigo-300 tracking-[0.14em] uppercase mb-1">
                                ★ Remember
                              </p>
                              <p className="text-[13.5px] text-ink leading-relaxed">{s.takeaway}</p>
                            </aside>
                          )}
                        </div>
                      ))}
                      <Link
                        to="/sandbox"
                        className="inline-flex items-center gap-1.5 mt-5 text-[13px] font-medium text-indigo-300 hover:text-indigo-200"
                      >
                        Apply it in the sandbox <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Interview prep link-card */}
        <section className="pt-10">
          <Link
            to="/interview"
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
                      className="group text-left bg-surface border border-white/[0.07] rounded-xl p-4 flex items-start gap-3
                                 hover:bg-elevated hover:border-white/[0.12] transition-colors duration-150"
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
              className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink border border-white/[0.1] rounded-lg px-5 py-2.5 hover:bg-elevated hover:border-indigo-500/35 transition-colors"
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
