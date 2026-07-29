// RAG citation chips — shared between the case-study mentor (CaseStudyDetail)
// and the floating global assistant (FloatingChat). Sources are server-
// filtered to only what the answer actually cited (services/mentor.py
// _cited_sources) — every chip shown here is backed by real platform content
// AND was actually used, not just retrieved.
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

export default function SourceChips({ sources }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 pt-3.5 border-t border-hairline/[0.06]">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted/60 mb-2">
        <BookOpen size={11} aria-hidden /> Grounded in
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <Link
            key={s.tag}
            to={s.path}
            className="inline-flex items-center gap-1.5 max-w-full rounded-md border border-indigo-500/25 bg-indigo-500/[0.07]
                       px-2 py-1 text-[11.5px] text-indigo-200 hover:bg-indigo-500/[0.14] transition-colors"
            title={s.heading ? `${s.title} — ${s.heading}` : s.title}
          >
            <span className="font-mono text-[9.5px] text-indigo-400" aria-hidden>{s.tag}</span>
            <span className="truncate">{s.title}{s.heading ? ` › ${s.heading}` : ""}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
