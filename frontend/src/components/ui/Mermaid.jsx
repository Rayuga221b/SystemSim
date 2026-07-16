// Renders a ```mermaid code block as a real, styled diagram (flowchart,
// sequence, etc.) instead of text. Themed to the app: a dark canvas (like our
// code blocks and hand-authored SVGs, so it reads the same in light or dark
// mode) with violet/indigo nodes, cyan accents, and a subtle node-hover lift.
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
      // nodes
      primaryColor: "#211d3a",
      primaryBorderColor: "#7C5CFF",
      primaryTextColor: "#EAE7F5",
      secondaryColor: "#152433",
      secondaryBorderColor: "#38BDF8",
      secondaryTextColor: "#EAE7F5",
      tertiaryColor: "#12261f",
      tertiaryBorderColor: "#34E2A1",
      // edges + labels
      lineColor: "#8b8598",
      textColor: "#c7c2d6",
      edgeLabelBackground: "#0b0a14",
      // subgraph clusters
      clusterBkg: "rgba(124,92,255,0.06)",
      clusterBorder: "#4a4560",
      titleColor: "#EAE7F5",
      // sequence diagrams
      actorBkg: "#211d3a",
      actorBorder: "#7C5CFF",
      actorTextColor: "#EAE7F5",
      signalColor: "#c7c2d6",
      signalTextColor: "#c7c2d6",
      labelBoxBkgColor: "#152433",
      labelBoxBorderColor: "#38BDF8",
      noteBkgColor: "#12261f",
      noteBorderColor: "#34E2A1",
      noteTextColor: "#EAE7F5",
      fontSize: "14px",
    },
    flowchart: { curve: "basis", htmlLabels: true, padding: 14, useMaxWidth: true },
    sequence: { useMaxWidth: true },
  });
  _inited = true;
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
    <figure className="mermaid-figure my-6 rounded-xl border border-hairline/[0.08] bg-[#0b0a14] p-5 overflow-x-auto flex justify-center">
      {/* mermaid output is sanitized (securityLevel: strict) before injection */}
      <div className="mermaid-svg w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
    </figure>
  );
}
