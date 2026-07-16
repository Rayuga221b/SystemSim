// The simulation control bar floating over the canvas: load slider (log
// scale), read/write mix, run button, examples, clear. Fast loop, no modals.
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Loader2, Trash2, ChevronDown, LayoutTemplate, Save, HelpCircle, BookOpen } from "lucide-react";
import { useStore } from "@/store";
import { fmt } from "@/lib/components";
import { PRESETS } from "@/lib/presets";

const PHASE_LABELS = {
  propagating: "Propagating load…",
  measuring: "Finding bottlenecks…",
  analyzing: "Scoring tradeoffs…",
};

const HOW_IT_WORKS = [
  { step: "01", title: "Build", text: "Drag components from the palette, connect them left → right with the node handles." },
  { step: "02", title: "Set the traffic", text: "Pick a load (rps) and the read/write mix — the two numbers that shape every design." },
  { step: "03", title: "Simulate", text: "Nodes light up by utilization; the results panel shows bottlenecks, latency, and tradeoffs." },
  { step: "04", title: "Break it on purpose", text: "Select a node → Chaos section: crash a cache, lag a replica, re-run, watch the blast radius." },
];

// Log-scale slider: 0..100 ↦ 10 rps .. 1M rps
const sliderToRps = (v) => niceRound(Math.pow(10, 1 + v / 20));
const rpsToSlider = (rps) => Math.max(0, Math.min(100, (Math.log10(rps) - 1) * 20));
function niceRound(x) {
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  return Math.round(x / (mag / 10)) * (mag / 10);
}

export default function SimBar({ onSave }) {
  const loadRps = useStore((s) => s.loadRps);
  const setLoadRps = useStore((s) => s.setLoadRps);
  const readPct = useStore((s) => s.readPct);
  const setReadPct = useStore((s) => s.setReadPct);
  const simRunning = useStore((s) => s.simRunning);
  const simPhase = useStore((s) => s.simPhase);
  const runSimulation = useStore((s) => s.runSimulation);
  const clearCanvas = useStore((s) => s.clearCanvas);
  const clearSimResult = useStore((s) => s.clearSimResult);
  const loadGraph = useStore((s) => s.loadGraph);
  const failureCount = useStore((s) => Object.keys(s.failures).length);
  const clearFailures = useStore((s) => s.clearFailures);
  const nodeCount = useStore((s) => s.nodes.length);

  const [examplesOpen, setExamplesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);
  const helpRef = useRef(null);

  useEffect(() => {
    if (!examplesOpen && !helpOpen) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setExamplesOpen(false);
      if (!helpRef.current?.contains(e.target)) setHelpOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [examplesOpen, helpOpen]);

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 flex-wrap justify-center
                    max-w-[calc(100%-5.5rem)] bg-surface/90 backdrop-blur border border-hairline/[0.08] rounded-xl pl-4 pr-2 py-2 shadow-lg shadow-black/30">
      {/* Load */}
      <label className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">Load</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={rpsToSlider(loadRps)}
          onChange={(e) => setLoadRps(sliderToRps(+e.target.value))}
          className="w-36 accent-indigo-500"
          aria-label="Load in requests per second"
        />
        <span className="font-mono text-[12px] text-ink w-[4.5rem] text-right tabular-nums">
          {fmt(loadRps)} <span className="text-muted text-[10px]">rps</span>
        </span>
      </label>

      <div className="w-px h-5 bg-hairline/[0.08]" aria-hidden />

      {/* Read/write mix */}
      <label className="flex items-center gap-2" title="Share of traffic that is reads vs writes">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">R/W</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={readPct}
          onChange={(e) => setReadPct(+e.target.value)}
          className="w-20 accent-indigo-500"
          aria-label="Read percentage of the workload"
        />
        <span className="font-mono text-[11px] text-muted w-[3.6rem] tabular-nums">{readPct}/{100 - readPct}</span>
      </label>

      <div className="w-px h-5 bg-hairline/[0.08]" aria-hidden />

      {/* Run */}
      <button
        type="button"
        onClick={runSimulation}
        disabled={simRunning || nodeCount === 0}
        aria-live="polite"
        className={`btn-primary flex items-center justify-center gap-1.5 text-white text-[13px] font-medium rounded-lg px-4 py-1.5
                   min-w-[10.5rem] disabled:cursor-not-allowed ${simRunning ? "" : "disabled:opacity-40"}`}
      >
        {simRunning ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span className="font-mono text-[11.5px]">{PHASE_LABELS[simPhase] || "Simulating…"}</span>
          </>
        ) : (
          <>
            <Play size={14} /> Simulate
          </>
        )}
      </button>

      {failureCount > 0 && (
        <button
          type="button"
          onClick={clearFailures}
          className="font-mono text-[10px] text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded-md px-2 py-1 hover:bg-amber-400/20"
          title="Click to clear injected failures"
        >
          {failureCount} failure{failureCount > 1 ? "s" : ""} injected
        </button>
      )}

      {/* Examples */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setExamplesOpen((o) => !o)}
          className="flex items-center gap-1.5 text-[12px] text-muted hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-elevated transition-colors"
        >
          <LayoutTemplate size={13} /> Examples <ChevronDown size={12} />
        </button>
        {examplesOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-64 bg-elevated border border-hairline/[0.09] rounded-lg py-1 shadow-xl shadow-black/40">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  loadGraph(p.graph);
                  setLoadRps(p.load_rps);
                  clearSimResult();
                  clearFailures();
                  setExamplesOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-hairline/[0.04]"
              >
                <span className="block text-[12.5px] text-ink">{p.label}</span>
                <span className="block text-[11px] text-muted leading-snug mt-0.5">{p.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save / clear */}
      <button
        type="button"
        onClick={onSave}
        disabled={nodeCount === 0}
        className="p-2 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors disabled:opacity-30"
        aria-label="Save design"
        title="Save design"
      >
        <Save size={15} />
      </button>
      <button
        type="button"
        onClick={() => { clearCanvas(); clearSimResult(); clearFailures(); }}
        disabled={nodeCount === 0}
        className="p-2 rounded-lg text-muted hover:text-red-400 hover:bg-elevated transition-colors disabled:opacity-30"
        aria-label="Clear canvas"
        title="Clear canvas"
      >
        <Trash2 size={15} />
      </button>

      {/* How it works */}
      <div className="relative" ref={helpRef}>
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          className={`p-2 rounded-lg transition-colors ${helpOpen ? "text-indigo-300 bg-elevated" : "text-muted hover:text-ink hover:bg-elevated"}`}
          aria-label="How it works"
          aria-expanded={helpOpen}
          title="How it works"
        >
          <HelpCircle size={15} />
        </button>
        {helpOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-[300px] bg-elevated border border-hairline/[0.09] rounded-xl p-4 shadow-xl shadow-black/40">
            <h3 className="text-[12.5px] font-medium text-ink mb-3">The loop</h3>
            <ol className="flex flex-col gap-2.5">
              {HOW_IT_WORKS.map((s) => (
                <li key={s.step} className="flex gap-2.5">
                  <span className="font-mono text-[10px] text-indigo-400/80 mt-0.5 shrink-0">{s.step}</span>
                  <span className="text-[11.5px] leading-snug">
                    <span className="text-ink font-medium">{s.title}</span>
                    <span className="text-muted"> — {s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 pt-3 border-t border-hairline/[0.06] text-[11px] text-muted">
              Tip: <kbd className="font-mono text-[10px] text-ink/80 bg-hairline/[0.06] border border-hairline/[0.1] rounded px-1">Del</kbd> removes
              a selected node · the <BookOpen size={10} className="inline text-indigo-300" aria-hidden /> icon
              in the palette opens theory.
            </p>
            <Link
              to="/learn"
              onClick={() => setHelpOpen(false)}
              className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-indigo-300 hover:text-indigo-200"
            >
              <BookOpen size={11} /> Read the core concepts
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
