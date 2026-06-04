import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { CHALLENGES }               from "@/data/challenges";
import { DIFFICULTIES, DIFFICULTY_BADGE } from "@/data/constants";

export default function Challenges() {
  const [active, setActive] = useState("All");

  const filtered = active === "All"
    ? CHALLENGES
    : CHALLENGES.filter((c) => c.difficulty === active);

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="border-b border-white/[0.05] py-16 sm:py-20">
          <h1 className="font-display font-semibold text-4xl text-ink mb-4 text-balance">
            Challenges
          </h1>
          <p className="text-muted text-[1rem] max-w-[58ch] leading-[1.65]">
            Structured system design scenarios. Build your architecture on the canvas and see how it compares against a reference solution.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap py-4 border-b border-white/[0.05]">
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
            {filtered.length} challenge{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Cards */}
        <div className="pt-5 pb-24 flex flex-col gap-4">
          {filtered.map((c) => (
            <div
              key={c.title}
              className="group bg-elevated border border-white/[0.08] rounded-xl p-6 hover:border-indigo-500/25 hover:bg-white/[0.02] cursor-pointer transition-all duration-150"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-semibold text-ink text-[1.0625rem] leading-snug text-balance">
                  {c.title}
                </h3>
                <div className="flex items-center gap-2.5 shrink-0 mt-0.5">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[c.difficulty]}`}>
                    {c.difficulty}
                  </span>
                  <span className="font-mono text-xs text-muted/50">{c.time}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-muted text-[1rem] leading-[1.65] mb-4 max-w-[65ch]">{c.desc}</p>

              {/* Footer row */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2 flex-wrap">
                  {c.tags.map((tag) => (
                    <span key={tag} className="font-mono text-[11px] text-muted/60 bg-base border border-white/[0.06] px-2 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="text-sm font-medium text-muted group-hover:text-indigo-400 transition-colors duration-150 flex items-center gap-1.5 shrink-0">
                  Start <ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-muted">No challenges at this difficulty yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
