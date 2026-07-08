// Minimal markdown renderer: paragraphs, **bold**, *italic*, `code`. Content is
// ours (trusted), rendered via React elements — no dangerouslySetInnerHTML.
// Bold is matched before italic so **x** never gets mistaken for *x*.
//
// Font: this is the one place in the app that renders real reading-length
// paragraphs (case-study Problem/Solution, Learn chapters). `font-read`
// (Source Serif 4, see tailwind.config.js + DESIGN.md "Visual rebrand")
// gives long-form prose a distinct rhythm from UI chrome — the eye can tell
// "this is an article" from "this is a control" at a glance. Headings,
// labels, and every other UI element stay on font-display / font-sans.
export default function Prose({ text, className = "" }) {
  if (!text) return null;
  return text.split(/\n\s*\n/).map((para, i) => (
    <p key={i} className={`font-read text-[1rem] text-ink/85 leading-[1.75] mb-4 last:mb-0 ${className}`}>
      {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((chunk, j) => {
        if (chunk.startsWith("**")) return <strong key={j} className="text-ink font-semibold">{chunk.slice(2, -2)}</strong>;
        if (chunk.startsWith("`")) return <code key={j} className="font-mono text-[0.8em] not-italic text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">{chunk.slice(1, -1)}</code>;
        if (chunk.startsWith("*")) return <em key={j} className="text-ink/95 not-italic font-medium">{chunk.slice(1, -1)}</em>;
        return chunk;
      })}
    </p>
  ));
}
