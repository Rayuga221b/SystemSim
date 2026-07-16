// Rich Markdown renderer for long-form roadmap lessons.
//
// WHY a new component (not the existing Prose.jsx): Prose only handles
// bold/italic/inline-code in flat paragraphs. Roadmap lessons are full GFM —
// headings, tables, fenced code, nested lists, blockquotes. react-markdown +
// remark-gfm do the parsing; every element is mapped to the app's design
// tokens so a lesson reads like documentation (MDN/GFG feel) rather than a
// raw dump. Font system per DESIGN.md: font-read (Source Serif 4) for reading
// prose, font-display (Space Grotesk) for headings, font-mono for code.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/vs2015.css"; // VS Code dark theme colors the .hljs token spans
import { assetUrl } from "@/api/client";
import Mermaid from "@/components/ui/Mermaid";

// Heading ids let the on-this-page rail + deep links jump to a section.
const slugify = (children) =>
  String(Array.isArray(children) ? children.join("") : children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const components = {
  h1: ({ children }) => (
    <h1 id={slugify(children)} className="font-display font-semibold text-ink text-[1.6rem] leading-tight mt-10 mb-4 scroll-mt-24 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(children)} className="font-display font-semibold text-indigo-200 text-[1.3rem] leading-snug mt-10 mb-3 pb-2 border-b border-hairline/[0.08] scroll-mt-24 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(children)} className="font-display font-semibold text-indigo-300 text-[1.05rem] leading-snug mt-7 mb-2 scroll-mt-24">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="font-read text-[1.02rem] text-ink/85 leading-[1.8] my-4">{children}</p>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:decoration-indigo-400 transition-colors">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="text-ink font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-ink/95 italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="font-read text-[1.02rem] text-ink/85 leading-[1.7] my-4 pl-5 space-y-1.5 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.7em] [&>li]:before:w-1.5 [&>li]:before:h-1.5 [&>li]:before:-translate-y-1/2 [&>li]:before:rounded-full [&>li]:before:bg-indigo-400/60">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="font-read text-[1.02rem] text-ink/85 leading-[1.7] my-4 pl-6 space-y-1.5 list-decimal marker:text-indigo-400/70 marker:font-mono marker:text-[0.85em]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-5 border-l-2 border-indigo-500/50 bg-indigo-500/[0.06] rounded-r-lg pl-4 pr-4 py-1 [&>p]:text-ink/80 [&>p]:italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-0 h-px bg-hairline/[0.1]" />,
  // Fenced code blocks vs. inline code. react-markdown v9 dropped the `inline`
  // prop, so we distinguish by content: a fenced block spans multiple lines (or
  // carries a language- class), inline code never contains a newline. This also
  // correctly handles language-less fences (```), which our lessons use.
  code: ({ className, children }) => {
    const text = String(children ?? "");
    const lang = /language-(\w+)/.exec(className || "")?.[1];
    const isBlock = !!lang || text.includes("\n");
    if (!isBlock) {
      return (
        <code className="font-mono text-[0.82em] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
          {children}
        </code>
      );
    }
    // Flowcharts / sequence diagrams render as real diagrams, not text.
    if (lang === "mermaid") return <Mermaid chart={text} />;

    // Language-less fences (```) are CLI sessions / command output — give them
    // terminal chrome (a mac-style dot row + darker canvas + left accent) so
    // they read as "a terminal", visibly distinct from the syntax-highlighted
    // code blocks below.
    if (!lang) {
      return (
        <span className="block my-5 overflow-hidden rounded-xl border border-hairline/[0.1] border-l-2 border-l-indigo-500/50 bg-[#060510]">
          <span className="flex items-center gap-1.5 px-4 py-2 border-b border-hairline/[0.06] bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/70" aria-hidden />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/70" aria-hidden />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/70" aria-hidden />
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-muted/40 select-none">
              terminal
            </span>
          </span>
          <code className="block whitespace-pre overflow-x-auto text-ink/85 font-mono text-[0.82rem] leading-relaxed px-4 py-3.5">
            {children}
          </code>
        </span>
      );
    }

    // Syntax-highlighted block. rehype-highlight has already tokenized the
    // children into <span class="hljs-…"> nodes and put the `hljs` +
    // `language-…` classes on this element via className — we pass both through
    // untouched so the vs2015 theme colors the tokens (no hard text-ink here,
    // or it would override the token spans). The wrapper keeps our chrome.
    return (
      <span className="group relative block my-5">
        <span className="absolute right-3 top-2.5 z-10 font-mono text-[10px] uppercase tracking-wider text-muted/50 select-none">
          {lang}
        </span>
        <code className={`${className || ""} block whitespace-pre overflow-x-auto rounded-xl border border-hairline/[0.08] !bg-[#0b0a14] font-mono text-[0.82rem] leading-relaxed !p-4`}>
          {children}
        </code>
      </span>
    );
  },
  pre: ({ children }) => <>{children}</>, // code handles its own wrapper
  // Images (diagrams / figures). Rendered on their own dark canvas so they read
  // the same regardless of the page's light/dark theme — the alt text doubles
  // as a caption. src is resolved against the API base (assets are served from
  // the backend's /static). Markdown syntax: ![caption](/static/roadmap/…/x.svg)
  // Uses <span>s (phrasing content) with display:block rather than
  // <figure>/<div>: react-markdown wraps a lone image in a <p>, and block
  // elements inside <p> are invalid HTML (React warns + can break hydration).
  img: ({ src, alt }) => (
    <span className="block my-6">
      <span className="block rounded-xl border border-hairline/[0.08] bg-[#0b0a14] p-4 overflow-x-auto">
        <img src={assetUrl(src)} alt={alt || ""} loading="lazy" className="block max-w-full h-auto mx-auto" />
      </span>
      {alt && (
        <span className="block mt-2 text-center font-sans text-[0.8rem] text-muted/70">{alt}</span>
      )}
    </span>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-hairline/[0.08]">
      <table className="w-full border-collapse text-[0.9rem]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left font-display font-semibold text-ink text-[0.82rem] px-4 py-2.5 border-b border-hairline/[0.1]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="font-sans text-ink/80 text-[0.88rem] px-4 py-2.5 border-b border-hairline/[0.05] align-top">
      {children}
    </td>
  ),
};

export default function Markdown({ children, className = "" }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={components}>
        {children || ""}
      </ReactMarkdown>
    </div>
  );
}
