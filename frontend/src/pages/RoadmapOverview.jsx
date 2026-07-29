// The System Design Roadmap — overview / table of contents.
//
// Module-grouped map of the whole track. Each module is a colored "rail" with
// its lessons; clicking a lesson opens the docs-style reader
// (/learn/roadmap/:slug). Content comes from the DB via /roadmap — never a
// static file (project decision: this is real, growing content).
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Clock, BookOpen, Map, Lock } from "lucide-react";
import { api } from "@/api/client";
import PageGlow from "@/components/ui/PageGlow";

function LessonRow({ lesson, color }) {
  return (
    <Link
      to={`/learn/roadmap/${lesson.slug}`}
      className="group flex items-center gap-4 rounded-xl border border-hairline/[0.06] bg-surface px-4 py-3
                 hover:border-hairline/[0.14] hover:bg-elevated transition-colors duration-150"
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-mono text-[11px] font-semibold"
        style={{ backgroundColor: `${color}1c`, color }}
      >
        {String(lesson.number).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display font-medium text-ink text-[0.92rem] leading-snug truncate">
          {lesson.title}
        </span>
        <span className="block text-muted text-[0.8rem] leading-snug mt-0.5 line-clamp-1">
          {lesson.summary}
        </span>
      </span>
      <span className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-muted/50 shrink-0">
        <Clock size={10} aria-hidden /> {lesson.reading_minutes}m
      </span>
      <ArrowRight
        size={14}
        className="text-muted/30 group-hover:text-ink shrink-0 transition-all group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function ModuleBlock({ module, index }) {
  const empty = module.lesson_count === 0;
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative pl-6 sm:pl-8"
    >
      {/* Track spine */}
      <span
        aria-hidden
        className="absolute left-0 top-1.5 bottom-0 w-px"
        style={{ background: `linear-gradient(${module.color}66, transparent)` }}
      />
      <span
        aria-hidden
        className="absolute left-[-4.5px] top-1.5 w-[9px] h-[9px] rounded-full ring-4 ring-base"
        style={{ backgroundColor: module.color }}
      />

      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h2 className="font-display font-semibold text-ink text-[1.15rem]">
          <span className="font-mono text-[11px] mr-2" style={{ color: module.color }}>
            {String(index + 1).padStart(2, "0")}
          </span>
          {module.label}
        </h2>
        <span className="font-mono text-[10px] text-muted/50 shrink-0 uppercase tracking-wider">
          {empty ? "soon" : `${module.lesson_count} lesson${module.lesson_count > 1 ? "s" : ""}`}
        </span>
      </div>
      <p className="text-muted text-[0.85rem] mb-4 max-w-[62ch]">{module.blurb}</p>

      {empty ? (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-hairline/[0.1] px-4 py-4 text-muted/60">
          <Lock size={13} aria-hidden />
          <span className="text-[0.82rem]">Lessons for this module are being written.</span>
        </div>
      ) : (
        <div className="space-y-2 mb-10">
          {module.lessons.map((l) => (
            <LessonRow key={l.slug} lesson={l} color={module.color} />
          ))}
        </div>
      )}
    </motion.section>
  );
}

export default function RoadmapOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRoadmap().then(setData).catch((e) => setError(e.message));
  }, []);

  const firstLesson = data?.modules.flatMap((m) => m.lessons)[0];

  return (
    <div className="relative bg-base min-h-screen">
      <PageGlow blobs={[
        { x: "15%", y: "0%", w: "55%", h: "60%", color: "rgba(124, 92, 255,0.16)" },
        { x: "90%", y: "10%", w: "40%", h: "50%", color: "rgba(56,189,248,0.08)" },
      ]} />
      <div className="relative z-10 max-w-4xl mx-auto px-6">

        {/* Back to Learn */}
        <div className="pt-8">
          <Link to="/learn" className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted hover:text-ink transition-colors uppercase tracking-wider">
            <ArrowLeft size={12} /> The Library
          </Link>
        </div>

        {/* Hero */}
        <div className="py-10 sm:py-12 border-b border-hairline/[0.05]">
          <p className="flex items-center gap-2 font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            <Map size={13} /> Guided track
          </p>
          <h1 className="font-display font-semibold text-4xl sm:text-5xl mb-4 bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent">
            {data?.title || "The System Design Roadmap"}
          </h1>
          <p className="text-muted text-[0.95rem] max-w-[58ch] leading-relaxed">
            {data?.subtitle ||
              "A sequenced path from first principles to production war stories — built to be read in order, then applied in the sandbox."}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-7">
            {firstLesson && (
              <Link
                to={`/learn/roadmap/${firstLesson.slug}`}
                className="btn-primary inline-flex items-center gap-2 text-white text-[13.5px] font-medium rounded-lg px-5 py-2.5"
              >
                Start the roadmap <ArrowRight size={14} />
              </Link>
            )}
            {data && (
              <span className="inline-flex items-center gap-2 text-[13px] text-muted border border-hairline/[0.1] rounded-lg px-4 py-2.5">
                <BookOpen size={14} className="text-indigo-400" />
                {data.total_lessons} lessons · {data.modules.length} modules
              </span>
            )}
          </div>
        </div>

        {/* Modules */}
        <div className="pt-12 pb-16">
          {error && (
            <p className="text-red-400 text-sm">Couldn't load the roadmap: {error}</p>
          )}
          {!data && !error && (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-surface animate-pulse" />
              ))}
            </div>
          )}
          {data?.modules.map((m, i) => (
            <ModuleBlock key={m.id} module={m} index={i} />
          ))}
        </div>

        {/* Attribution — content is adapted, credit the source series. */}
        {data?.note && (
          <p className="pb-16 text-[0.72rem] text-muted/40 leading-relaxed max-w-[70ch] border-t border-hairline/[0.05] pt-6">
            {data.note}
          </p>
        )}
      </div>
    </div>
  );
}
