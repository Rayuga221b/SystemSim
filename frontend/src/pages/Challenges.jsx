import { useState } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { CHALLENGES }                    from "@/data/challenges";
import { DIFFICULTIES, DIFFICULTY_BADGE } from "@/data/constants";

const DIFFICULTY_LEFT = {
  Beginner:     "border-l-emerald-500/50 group-hover:border-l-emerald-400",
  Intermediate: "border-l-amber-500/50   group-hover:border-l-amber-400",
  Advanced:     "border-l-red-500/50     group-hover:border-l-red-400",
};

export default function Challenges() {
  const [active, setActive] = useState("All");

  const filtered = active === "All"
    ? CHALLENGES
    : CHALLENGES.filter((c) => c.difficulty === active);

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-white/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            Practice Arena
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl text-ink mb-3">
                Challenges
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                Structured system design scenarios. Build your architecture on the canvas, then see how it stacks up against a reference solution.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">{CHALLENGES.length}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Scenarios</p>
              </div>
              <div className="w-px h-9 bg-white/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-amber-400 font-bold leading-none mb-1.5">{DIFFICULTIES.length - 1}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Levels</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap py-4 border-b border-white/[0.05]">
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
            {filtered.length} challenge{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Cards */}
        <div className="pt-6 pb-24 flex flex-col gap-3">
          {filtered.map((c, i) => (
            <article
              key={c.title}
              className={`group relative bg-surface border border-white/[0.07] border-l-[3px] rounded-xl p-6 cursor-pointer transition-all duration-200 hover:bg-elevated hover:border-white/[0.10] ${DIFFICULTY_LEFT[c.difficulty]}`}
            >
              {/* Ghost number */}
              <span className="absolute top-3 right-5 font-display font-bold text-[4.5rem] leading-none text-white/[0.025] select-none pointer-events-none">
                {String(i + 1).padStart(2, "0")}
              </span>

              {/* Title + badge row */}
              <div className="flex items-start justify-between gap-4 mb-2 pr-8">
                <h3 className="font-display font-semibold text-ink text-[1.05rem] leading-snug">
                  {c.title}
                </h3>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 mt-0.5 ${DIFFICULTY_BADGE[c.difficulty]}`}>
                  {c.difficulty}
                </span>
              </div>

              {/* Description */}
              <p className="text-muted text-[0.875rem] leading-relaxed mb-4 max-w-[62ch]">
                {c.desc}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted/45">
                    <Clock size={10} />
                    {c.time}
                  </span>
                  <span className="text-muted/20 font-mono text-xs">·</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {c.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-mono text-[10px] text-muted/50 bg-base/80 border border-white/[0.05] px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-sm text-muted/50 group-hover:text-indigo-400 transition-colors duration-150 flex items-center gap-1.5 shrink-0 font-medium">
                  Start
                  <ArrowRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </div>
            </article>
          ))}

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-muted/50">No challenges at this difficulty yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
