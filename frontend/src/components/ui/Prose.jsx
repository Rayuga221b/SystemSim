// Minimal markdown renderer: paragraphs, **bold**, *italic*, `code`. Content is
// ours (trusted), rendered via React elements — no dangerouslySetInnerHTML.
// Bold is matched before italic so **x** never gets mistaken for *x*.
export default function Prose({ text, className = "" }) {
  if (!text) return null;
  return text.split(/\n\s*\n/).map((para, i) => (
    <p key={i} className={`text-[0.9375rem] text-ink/85 leading-[1.75] mb-4 last:mb-0 ${className}`}>
      {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((chunk, j) => {
        if (chunk.startsWith("**")) return <strong key={j} className="text-ink font-semibold">{chunk.slice(2, -2)}</strong>;
        if (chunk.startsWith("`")) return <code key={j} className="font-mono text-[0.8em] text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">{chunk.slice(1, -1)}</code>;
        if (chunk.startsWith("*")) return <em key={j} className="text-ink/95 not-italic font-medium">{chunk.slice(1, -1)}</em>;
        return chunk;
      })}
    </p>
  ));
}
