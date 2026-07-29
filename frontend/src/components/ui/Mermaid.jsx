// Renders a ```mermaid code block as a real, styled diagram (flowchart,
// sequence, etc.) instead of text. Themed to the app: a fixed indigo→teal
// canvas — deliberately NOT the near-black of code blocks, so diagrams stand
// out from code on the page (and read the same in light or dark mode) — with
// saturated violet/cyan/mint nodes and a subtle node-hover lift.
//
// Robust by design: mermaid.render is async and throws on malformed syntax, so
// a bad diagram falls back to showing the raw source in a code block rather
// than crashing the lesson.
//
// Maximize: inline diagrams sit in a ~62ch prose column, which is often too
// narrow for a flowchart's node labels to stay legible. A maximize button
// opens the SAME rendered SVG (no re-render) in a large floating panel over
// the text — vector output, so it scales up losslessly instead of pixelating.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mermaid from "mermaid";
import { Maximize2, Minus, Plus, Scan, X } from "lucide-react";

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
// entities in arrows (`--&gt;` for `-->`, `-&gt;&gt;` for `->>`, `&amp;`), node
// labels with unquoted parentheses — `Primary[Primary DB (AZ-A)]` — and node
// labels with a literal raw newline inside them (e.g.
// `Recreate[Recreate\nStop, Deploy, Start]`), which the flowchart grammar
// can't parse at all. When a chart fails to parse we decode the entities,
// collapse embedded newlines inside `[…]`/`{…}` labels to a space, quote
// parenthesized labels (`Primary["Primary DB (AZ-A)"]`) and retry once before
// falling back to raw source. Only rectangle `[…]` and decision `{…}` labels
// are quoted; shape tokens like `[(db)]` and `([…])` start with `(` and are
// deliberately left alone.
function sanitize(chart) {
  return chart
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\[([^[\]]*)\]/g, (m, label) => `[${label.replace(/\r?\n/g, " ")}]`)
    .replace(/\{([^{}]*)\}/g, (m, label) => `{${label.replace(/\r?\n/g, " ")}}`)
    .replace(/\[(?!\()([^[\]"]*\([^[\]]*)\]/g, '["$1"]')
    .replace(/\{([^{}"]*\([^{}]*)\}/g, '{"$1"}');
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

// Floating panel over the text, sized to comfortably cover the reading
// column rather than the full viewport — big enough that node labels are
// easy to read, not so big it feels like leaving the page. Portaled to
// <body> so it escapes the prose column's own overflow/stacking context.
//
// `natural` ({width, height} in CSS px) is measured from the ALREADY-
// RENDERED inline diagram at the moment the maximize button is clicked
// (see Mermaid() below) — not re-measured from a fresh copy injected here.
// That distinction is load-bearing: this markup has no `viewBox`, only a
// bare `width="100%"` with `useMaxWidth` capping it via an inline
// `max-width` at its own natural content width. Re-injecting the same HTML
// into a second container and measuring THAT copy is at the mercy of
// whatever width context this modal happens to give it (an indeterminate
// one, inside a flex `items-center` box, reliably fell back to the browser's
// 300×150 default-replaced-element size and silently clipped the real
// diagram — verified repeatedly). The inline instance has no such problem:
// it's already stably laid out on the page before the click ever happens.
//
// Zoom/pan model: `scale` is absolute (1 = natural pixel size), clamped to
// [fitScale, maxScale]. `offset` is a pan translation in px, applied AFTER
// scale, anchored at the viewport's center. Wheel/pinch zoom keep the point
// under the cursor/fingers stationary by solving for the offset that cancels
// the scale change at that point — the same math a map/photo viewer uses.
function MaximizedDiagram({ svg, natural, onClose }) {
  const boxRef = useRef(null);
  const fitScaleRef = useRef(1);
  const maxScaleRef = useRef(6);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetToFit = () => {
    setScale(fitScaleRef.current);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !natural.width || !natural.height) return;
    // getBoundingClientRect is the padded border-box; the toolbar sits inside
    // that padding (see the pb-20 on boxRef below), so the fit math has to
    // subtract padding itself or diagrams that touch an edge exactly would
    // render underneath the toolbar instead of clear of it.
    const b = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const availW = b.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = b.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.min(availW / natural.width, availH / natural.height, 3);
    fitScaleRef.current = fit;
    maxScaleRef.current = Math.max(fit * 3, 6);
    setScale(fit);
    setOffset({ x: 0, y: 0 });
  }, [natural]);

  // Zoom so the content point under (clientX, clientY) stays put.
  const zoomAt = (clientX, clientY, nextScale) => {
    const box = boxRef.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const cx = clientX - b.left - b.width / 2;
    const cy = clientY - b.top - b.height / 2;
    setScale((prevScale) => {
      const clamped = clamp(nextScale, fitScaleRef.current, maxScaleRef.current);
      setOffset((prevOffset) => {
        const contentX = (cx - prevOffset.x) / prevScale;
        const contentY = (cy - prevOffset.y) / prevScale;
        return { x: cx - contentX * clamped, y: cy - contentY * clamped };
      });
      return clamped;
    });
  };

  const zoomByButton = (factor) => {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b) return;
    zoomAt(b.left + b.width / 2, b.top + b.height / 2, scale * factor);
  };

  // Native (non-passive) wheel listener: React's onWheel is passive by
  // default, which silently drops preventDefault and lets the page scroll
  // under the modal while zooming.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, scale * (e.deltaY > 0 ? 0.9 : 1.1));
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, [scale]);

  const canPan = scale > fitScaleRef.current + 0.001;

  const onMouseDown = (e) => {
    if (!canPan) return;
    e.preventDefault();
    panRef.current = { startX: e.clientX, startY: e.clientY, startOffset: offset };
    setIsPanning(true);
    const onMove = (ev) => {
      const p = panRef.current;
      if (!p) return;
      setOffset({ x: p.startOffset.x + (ev.clientX - p.startX), y: p.startOffset.y + (ev.clientY - p.startY) });
    };
    const onUp = () => {
      panRef.current = null;
      setIsPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches;
      pinchRef.current = {
        startDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        startScale: scale,
      };
    } else if (e.touches.length === 1 && canPan) {
      const t = e.touches[0];
      panRef.current = { startX: t.clientX, startY: t.clientY, startOffset: offset };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const [t1, t2] = e.touches;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const nextScale = pinchRef.current.startScale * (dist / pinchRef.current.startDist);
      zoomAt((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2, nextScale);
    } else if (e.touches.length === 1 && panRef.current) {
      const t = e.touches[0];
      const p = panRef.current;
      setOffset({ x: p.startOffset.x + (t.clientX - p.startX), y: p.startOffset.y + (t.clientY - p.startY) });
    }
  };
  const onTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current = null;
    if (e.touches.length < 1) panRef.current = null;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged diagram"
    >
      <div className="relative w-[min(94vw,1100px)] h-[min(88vh,850px)] rounded-2xl border border-[#9d82ff]/25 bg-[linear-gradient(135deg,#1b1738_0%,#131c36_55%,#0e2233_100%)] shadow-2xl shadow-black/50 flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 hover:bg-black/50 text-white/80 hover:text-white transition-colors"
          aria-label="Close enlarged diagram"
        >
          <X size={18} />
        </button>
        <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-lg bg-black/30 p-1">
          <button
            type="button"
            onClick={() => zoomByButton(1 / 1.4)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-white/80 hover:text-white hover:bg-black/40 transition-colors"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={resetToFit}
            className="flex items-center justify-center w-8 h-8 rounded-md text-white/80 hover:text-white hover:bg-black/40 transition-colors"
            aria-label="Reset to fit"
            title="Reset to fit"
          >
            <Scan size={15} />
          </button>
          <button
            type="button"
            onClick={() => zoomByButton(1.4)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-white/80 hover:text-white hover:bg-black/40 transition-colors"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus size={16} />
          </button>
        </div>
        <div
          ref={boxRef}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`flex-1 pt-8 px-8 pb-20 flex items-center justify-center overflow-hidden touch-none ${
            canPan ? (isPanning ? "cursor-grabbing" : "cursor-grab") : ""
          } ${isPanning ? "select-none" : ""}`}
        >
          <div
            style={{
              width: natural.width || undefined,
              height: natural.height || undefined,
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "center",
            }}
            className="mermaid-svg-maximized shrink-0"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Mermaid({ chart }) {
  const [svg, setSvg] = useState("");
  const [failed, setFailed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const id = useRef(`mmd-${Math.random().toString(36).slice(2, 9)}`);
  const inlineWrapRef = useRef(null);

  const openMaximized = () => {
    const svgEl = inlineWrapRef.current?.querySelector("svg");
    const rect = svgEl?.getBoundingClientRect();
    // Measured from the already-rendered inline copy — see MaximizedDiagram's
    // docstring for why re-measuring a fresh injection is the fragile path.
    if (rect?.width && rect?.height) setNatural({ width: rect.width, height: rect.height });
    setMaximized(true);
  };

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
    <>
      {/* Fixed-dark surface (documented exception to the color-token rule): an
          indigo→teal gradient canvas, visibly distinct from the near-black
          code blocks, identical in light and dark mode. */}
      <figure className="group mermaid-figure relative my-6 rounded-xl border border-[#9d82ff]/20 bg-[linear-gradient(135deg,#1b1738_0%,#131c36_55%,#0e2233_100%)] p-5 overflow-x-auto flex justify-center">
        {svg && (
          <button
            type="button"
            onClick={openMaximized}
            className="absolute top-2.5 right-2.5 z-[1] flex items-center justify-center w-8 h-8 rounded-lg bg-black/25 text-white/70
                       opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/40 hover:text-white transition-all"
            aria-label="Maximize diagram"
            title="Maximize diagram"
          >
            <Maximize2 size={14} />
          </button>
        )}
        {/* mermaid output is sanitized (securityLevel: strict) before injection */}
        <div ref={inlineWrapRef} className="mermaid-svg w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
      </figure>
      {maximized && svg && (
        <MaximizedDiagram svg={svg} natural={natural} onClose={() => setMaximized(false)} />
      )}
    </>
  );
}
