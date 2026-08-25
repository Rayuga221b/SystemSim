// Minimal markdown renderer: paragraphs, lists, **bold**, *italic*, `code`.
// Content is ours (trusted), rendered via React elements — no
// dangerouslySetInnerHTML. Bold is matched before italic so **x** never gets
// mistaken for *x*.
//
// Font: this is the one place in the app that renders real reading-length
// paragraphs (case-study Problem/Solution, Learn chapters, AI mentor/chat
// answers). `font-read` (Source Serif 4, see tailwind.config.js + DESIGN.md
// "Visual rebrand") gives long-form prose a distinct rhythm from UI chrome —
// the eye can tell "this is an article" from "this is a control" at a
// glance. Headings, labels, and every other UI element stay on
// font-display / font-sans.
import { Fragment } from "react";

const LIST_ITEM_RE = /^\s*(?:[*-]|\d+\.)\s+/;

function inline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((chunk, j) => {
    const key = `${keyPrefix}-${j}`;
    if (chunk.startsWith("**")) return <strong key={key} className="text-ink font-semibold">{chunk.slice(2, -2)}</strong>;
    if (chunk.startsWith("`")) return <code key={key} className="font-mono text-[0.8em] not-italic text-indigo-300 bg-indigo-500/10 px-1 py-0.5 rounded">{chunk.slice(1, -1)}</code>;
    if (chunk.startsWith("*")) return <em key={key} className="text-ink/95 not-italic font-medium">{chunk.slice(1, -1)}</em>;
    return chunk;
  });
}

// Groups lines into blocks: paragraphs (consecutive non-list lines, joined by
// <br/>) and lists (a marker line plus any following non-marker lines, which
// are soft-wrapped continuations of that same item — the model frequently
// wraps one bullet's explanation onto its own line without a marker, so
// "every line starts with a marker" is too strict a test for a list block).
function toBlocks(text) {
  const blocks = [];
  let para = null;
  let list = null;

  const flushPara = () => { if (para) { blocks.push(para); para = null; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }

    if (LIST_ITEM_RE.test(line)) {
      flushPara();
      if (!list) list = { type: "list", ordered: /^\s*\d+\./.test(line), items: [] };
      list.items.push([line.replace(LIST_ITEM_RE, "")]);
    } else if (list) {
      list.items[list.items.length - 1].push(line);
    } else {
      if (!para) para = { type: "para", lines: [] };
      para.lines.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export default function Prose({ text, className = "" }) {
  if (!text) return null;
  return toBlocks(text).map((block, i) => {
    if (block.type === "list") {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag
          key={i}
          className={`font-read text-[1rem] text-ink/85 leading-[1.7] mb-4 last:mb-0 pl-5 space-y-1.5 ${
            block.ordered
              ? "list-decimal marker:text-indigo-400/70 marker:font-mono marker:text-[0.85em]"
              : "[&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.7em] [&>li]:before:w-1.5 [&>li]:before:h-1.5 [&>li]:before:-translate-y-1/2 [&>li]:before:rounded-full [&>li]:before:bg-indigo-400/60"
          } ${className}`}
        >
          {block.items.map((lines, j) => (
            <li key={j} className="pl-1">{inline(lines.join(" "), `${i}-${j}`)}</li>
          ))}
        </Tag>
      );
    }
    return (
      <p key={i} className={`font-read text-[1rem] text-ink/85 leading-[1.75] mb-4 last:mb-0 ${className}`}>
        {block.lines.map((line, j) => (
          <Fragment key={j}>
            {inline(line, `${i}-${j}`)}
            {j < block.lines.length - 1 && <br />}
          </Fragment>
        ))}
      </p>
    );
  });
}
