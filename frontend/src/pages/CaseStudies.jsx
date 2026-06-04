import { useState } from "react";
import { ArrowRight, BookOpen } from "lucide-react";
import { CASE_STUDIES }                   from "@/data/case-studies";
import { DIFFICULTIES, DIFFICULTY_BADGE } from "@/data/constants";
import BrandIcon                           from "@/components/ui/BrandIcon";

// Brand accent colors for left-border accents on grid cards
const BRAND_COLOR = {
  "Discord":    "#5865F2",
  "Twitter / X": "#60A5FA",
  "Netflix":    "#E50914",
  "Slack":      "#ECB22E",
  "Uber":       "#9CA3AF",
  "Amazon":     "#FF9900",
};

// ─── Featured card ──────────────────────────────────────────────────────────

function FeaturedCard({ cs }) {
  const color = BRAND_COLOR[cs.company] ?? "#6366F1";

  return (
    <article
      className="group relative bg-surface border border-white/[0.08] rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:border-white/[0.14] hover:bg-elevated"
    >
      {/* Top accent strip */}
      <div className="h-1 w-full" style={{ background: color }} />

      <div className="p-6 pt-5">
        {/* Company row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <BrandIcon company={cs.company} size={20} />
            <span className="font-mono text-xs text-muted/70 tracking-wide">{cs.company}</span>
          </div>
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[cs.difficulty]}`}>
            {cs.difficulty}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-display font-semibold text-ink text-xl leading-[1.25] mb-4">
          {cs.title}
        </h3>

        {/* Pull quote */}
        <blockquote
          className="border-l-2 pl-3.5 mb-5 italic text-[0.875rem] leading-relaxed"
          style={{ borderColor: color + "60", color: "rgba(128,128,152,0.85)" }}
        >
          {cs.pullQuote}
        </blockquote>

        {/* Tags + CTA */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1.5 flex-wrap">
            {cs.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[10px] text-muted/50 bg-base/60 border border-white/[0.05] px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
          <span className="text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1.5 shrink-0 transition-colors duration-150">
            Read study
            <ArrowRight size={13} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

// ─── Grid card (non-featured) ────────────────────────────────────────────────

function StudyCard({ cs }) {
  const color = BRAND_COLOR[cs.company] ?? "#6366F1";

  return (
    <article
      className="group relative bg-surface border border-l-[3px] border-white/[0.07] rounded-xl p-5 cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-white/[0.12]"
      style={{ borderLeftColor: color + "55" }}
    >
      {/* Company + difficulty */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <BrandIcon
            company={cs.company}
            size={16}
            className="opacity-60 group-hover:opacity-90 transition-opacity duration-200"
          />
          <span className="font-mono text-[11px] text-muted/60 tracking-wide">{cs.company}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${DIFFICULTY_BADGE[cs.difficulty]}`}>
          {cs.difficulty}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display font-semibold text-ink text-[1rem] leading-snug mb-2">
        {cs.title}
      </h3>

      {/* Description */}
      <p className="text-muted/70 text-[0.8125rem] leading-relaxed mb-4 line-clamp-2">
        {cs.desc}
      </p>

      {/* Tags + CTA */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {cs.tags.map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] text-muted/45 bg-base/80 border border-white/[0.05] px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="text-sm text-muted/50 group-hover:text-indigo-400 transition-colors duration-150 flex items-center gap-1 shrink-0 font-medium">
          Read
          <ArrowRight size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CaseStudies() {
  const [active, setActive] = useState("All");

  const featured = CASE_STUDIES.filter((cs) => cs.featured);
  const rest     = CASE_STUDIES.filter((cs) => !cs.featured);

  const filteredFeatured = active === "All" ? featured : featured.filter((cs) => cs.difficulty === active);
  const filteredRest     = active === "All" ? rest     : rest.filter((cs) => cs.difficulty === active);
  const totalCount       = filteredFeatured.length + filteredRest.length;

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-white/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            Engineering Incidents
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl text-ink mb-3">
                Case Studies
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                Real production incidents from top engineering teams. Each study walks you through the problem, the solution, and a canvas you can simulate yourself.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">{CASE_STUDIES.length}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Studies</p>
              </div>
              <div className="w-px h-9 bg-white/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-indigo-400 font-bold leading-none mb-1.5">{featured.length}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Featured</p>
              </div>
            </div>
          </div>
        </div>

        {/* Featured cards */}
        {filteredFeatured.length > 0 && (
          <div className="pt-10 pb-8">
            <p className="font-mono text-[11px] text-muted/40 uppercase tracking-[0.12em] mb-4">Featured</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {filteredFeatured.map((cs) => (
                <FeaturedCard key={cs.title} cs={cs} />
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap py-4 border-t border-white/[0.05]">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActive(d)}
              className={`text-sm px-4 py-1.5 rounded-full transition-all duration-150 ${
                active === d
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-muted/70 hover:text-ink hover:bg-white/[0.04]"
              }`}
            >
              {d}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-muted/40">
            {totalCount} case {totalCount !== 1 ? "studies" : "study"}
          </span>
        </div>

        {/* Rest — 2-column grid */}
        {filteredRest.length > 0 && (
          <div className="pt-5 pb-24">
            {active === "All" && (
              <p className="font-mono text-[11px] text-muted/40 uppercase tracking-[0.12em] mb-4">More Studies</p>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {filteredRest.map((cs) => (
                <StudyCard key={cs.title} cs={cs} />
              ))}
            </div>
          </div>
        )}

        {totalCount === 0 && (
          <div className="py-20 text-center pb-24">
            <p className="font-mono text-sm text-muted/50">No case studies at this difficulty yet.</p>
          </div>
        )}

      </div>
    </div>
  );
}
