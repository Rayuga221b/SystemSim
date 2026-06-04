import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { CASE_STUDIES }                   from "@/data/case-studies";
import { DIFFICULTIES, DIFFICULTY_BADGE } from "@/data/constants";
import BrandIcon                           from "@/components/ui/BrandIcon";

// ─── Featured hero card ───────────────────────────────────────────────────────

function FeaturedCard({ cs }) {
  return (
    <div
      className="group relative rounded-xl p-7 cursor-pointer border transition-all duration-200 hover:scale-[1.01]"
      style={{ background: cs.accent, borderColor: cs.accentBorder }}
    >
      {/* Company + difficulty */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <BrandIcon company={cs.company} size={22} />
          <span className="font-mono text-xs text-muted/80">{cs.company}</span>
        </div>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${DIFFICULTY_BADGE[cs.difficulty]}`}>
          {cs.difficulty}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display font-semibold text-ink text-xl leading-[1.2] mb-4 text-balance">
        {cs.title}
      </h3>

      {/* Pull quote */}
      <p className="text-muted text-[0.9375rem] leading-[1.65] italic mb-5 max-w-[52ch]">
        "{cs.pullQuote}"
      </p>

      {/* Tags + CTA */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 flex-wrap">
          {cs.tags.map((tag) => (
            <span key={tag} className="font-mono text-[11px] text-muted/60 bg-base/60 border border-white/[0.06] px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-sm font-semibold text-indigo-400 flex items-center gap-1.5 shrink-0">
          Read study <ArrowRight size={13} />
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CaseStudies() {
  const [active, setActive] = useState("All");

  const featured   = CASE_STUDIES.filter((cs) => cs.featured);
  const rest       = CASE_STUDIES.filter((cs) => !cs.featured);

  const filteredFeatured = active === "All" ? featured : featured.filter((cs) => cs.difficulty === active);
  const filteredRest     = active === "All" ? rest     : rest.filter((cs) => cs.difficulty === active);
  const totalCount       = filteredFeatured.length + filteredRest.length;

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="border-b border-white/[0.05] py-16 sm:py-20">
          <h1 className="font-display font-semibold text-4xl text-ink mb-4 text-balance">
            Case Studies
          </h1>
          <p className="text-muted text-[1rem] max-w-[58ch] leading-[1.65]">
            Real production incidents from top engineering teams. Each study is structured as Problem, Solution, and a canvas you can simulate yourself.
          </p>
        </div>

        {/* Featured hero cards */}
        {filteredFeatured.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 pt-10 pb-6">
            {filteredFeatured.map((cs) => (
              <FeaturedCard key={cs.title} cs={cs} />
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap py-4 border-t border-white/[0.05]">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActive(d)}
              className={`text-sm font-medium px-3.5 py-1.5 rounded-md transition-colors duration-150 ${
                active === d
                  ? "bg-indigo-500/12 text-indigo-300 border border-indigo-500/30"
                  : "text-muted hover:text-ink hover:bg-elevated border border-transparent"
              }`}
            >
              {d}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-muted/50">
            {totalCount} case {totalCount !== 1 ? "studies" : "study"}
          </span>
        </div>

        {/* Remaining case studies */}
        <div className="pt-1 pb-24 flex flex-col gap-4">
          {filteredRest.map((cs) => (
            <div
              key={cs.title}
              className="group bg-elevated border border-white/[0.08] rounded-xl p-6 hover:border-indigo-500/25 hover:bg-white/[0.02] cursor-pointer transition-all duration-150"
            >
              {/* Company + difficulty */}
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2.5">
                  <BrandIcon
                    company={cs.company}
                    size={18}
                    className="opacity-70 group-hover:opacity-100 transition-opacity duration-200"
                  />
                  <span className="font-mono text-xs text-muted/70">{cs.company}</span>
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${DIFFICULTY_BADGE[cs.difficulty]}`}>
                  {cs.difficulty}
                </span>
              </div>

              <h3 className="font-semibold text-ink text-[1.0625rem] leading-snug mb-2.5 text-balance">
                {cs.title}
              </h3>
              <p className="text-muted text-[1rem] leading-[1.65] mb-4 max-w-[65ch]">{cs.desc}</p>

              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2 flex-wrap">
                  {cs.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[11px] text-muted/60 bg-base border border-white/[0.06] px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-medium text-muted group-hover:text-indigo-400 transition-colors duration-150 flex items-center gap-1.5 shrink-0">
                  Read study <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}

          {filteredRest.length === 0 && filteredFeatured.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-muted">No case studies at this difficulty yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
