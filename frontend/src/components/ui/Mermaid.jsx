// Renders a ```mermaid code block as a real, styled diagram (flowchart,
// sequence, etc.) instead of text. Themed to the app: a fixed indigo→teal
// canvas — deliberately NOT the near-black of code blocks, so diagrams stand
// out from code on the page (and read the same in light or dark mode) — with
// saturated violet/cyan/mint nodes and a subtle node-hover lift.
//
// Robust by design: mermaid.render is async and throws on malformed syntax, so
// a bad diagram falls back to showing the raw source in a code block rather
// than crashing the lesson.
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let _inited = false;
function initMermaid() {
  if (_inited) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    fontFamily: "'Space Grotesk', system-ui, sans-serif",
    themeVariables: {
      background: "transparent",
      // nodes — saturated fills so they pop against the indigo→teal canvas
      primaryColor: "#2e2560",
      primaryBorderColor: "#9d82ff",
      primaryTextColor: "#f2effc",
      secondaryColor: "#0f3a52",
      secondaryBorderColor: "#4cc9ff",
      secondaryTextColor: "#f2effc",
      tertiaryColor: "#124434",
      tertiaryBorderColor: "#3ee8ac",
      // edges + labels
      lineColor: "#9d97b3",
      textColor: "#d6d1e6",
      edgeLabelBackground: "#1d1a38",
      // subgraph clusters
      clusterBkg: "rgba(124,92,255,0.10)",
      clusterBorder: "#5c548a",
      titleColor: "#f2effc",
      // sequence diagrams
      actorBkg: "#2e2560",
      actorBorder: "#9d82ff",
      actorTextColor: "#f2effc",
      signalColor: "#d6d1e6",
      signalTextColor: "#d6d1e6",
      labelBoxBkgColor: "#0f3a52",
      labelBoxBorderColor: "#4cc9ff",
      noteBkgColor: "#124434",
      noteBorderColor: "#3ee8ac",
      noteTextColor: "#f2effc",
      fontSize: "14px",
    },
    flowchart: { curve: "basis", htmlLabels: true, padding: 14, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  _inited = true;
}

// Ingested lessons sometimes emit charts mermaid's parser rejects: HTML-escaped
// entities in arrows (`--&gt;` for `-->`, `-&gt;&gt;` for `->>`, `&amp;`) and
// node labels with unquoted parentheses — `Primary[Primary DB (AZ-A)]`. When a
// chart fails to parse we decode the entities, quote those labels
// (`Primary["Primary DB (AZ-A)"]`) and retry once before falling back to raw
// source. Only rectangle `[…]` and decision `{…}` labels are quoted; shape
// tokens like `[(db)]` and `([…])` start with `(` and are deliberately left
// alone.
function sanitize(chart) {
  return chart
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[(?!\()([^[\]"]*\([^[\]]*)\]/g, '["$1"]')
    .replace(/\{([^{}"]*\([^{}]*)\}/g, '{"$1"}');
}

export default function Mermaid({ chart }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const id = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    initMermaid();
    mermaid
      .render(id.current, chart.trim())
      .catch(() => mermaid.render(`${id.current}-r`, sanitize(chart.trim())))
      .then(({ svg }) => { if (!cancelled) { setSvg(svg); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [chart]);

  // Graceful fallback: show the source if the diagram won't parse.
  if (failed) {
    return (
      <code className="block whitespace-pre overflow-x-auto rounded-xl border border-hairline/[0.08] bg-[#0b0a14] text-ink/80 font-mono text-[0.8rem] leading-relaxed p-4 my-5">
        {chart.trim()}
      </code>
    );
  }

  return (
    // Fixed-dark surface (documented exception to the color-token rule): an
    // indigo→teal gradient canvas, visibly distinct from the near-black code
    // blocks, identical in light and dark mode.
    <figure className="mermaid-figure my-6 rounded-xl border border-[#9d82ff]/20 bg-[linear-gradient(135deg,#1b1738_0%,#131c36_55%,#0e2233_100%)] p-5 overflow-x-auto flex justify-center">
      {/* mermaid output is sanitized (securityLevel: strict) before injection */}
      <div className="mermaid-svg w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
