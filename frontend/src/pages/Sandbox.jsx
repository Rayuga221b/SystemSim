// Sandbox — the hero of the product. Palette | canvas | inspector, with the
// simulation bar floating over the canvas. The canvas is the star; chrome recedes.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ReactFlowProvider } from "reactflow";
import { PanelLeftClose, PanelLeftOpen, MousePointerClick, BarChart3, X, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "@/store";
import { PRESETS } from "@/lib/presets";
import CanvasArea from "@/components/canvas/CanvasArea";
import SimBar from "@/components/canvas/SimBar";
import Palette from "@/components/sidebar/Palette";
import PropertiesPanel from "@/components/panels/PropertiesPanel";
import ResultsPanel from "@/components/panels/ResultsPanel";
import LearnDrawer from "@/components/panels/LearnDrawer";
import AIExplainDrawer from "@/components/panels/AIExplainDrawer";
import SaveDesignModal from "@/components/panels/SaveDesignModal";

export default function Sandbox() {
  const location = useLocation();
  const nodes = useStore((s) => s.nodes);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const selectNode = useStore((s) => s.selectNode);
  const simResult = useStore((s) => s.simResult);
  const simError = useStore((s) => s.simError);
  const loadGraph = useStore((s) => s.loadGraph);
  const setLoadRps = useStore((s) => s.setLoadRps);
  const clearSimResult = useStore((s) => s.clearSimResult);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);
  const simRunning = useStore((s) => s.simRunning);
  const explainSimulation = useStore((s) => s.explainSimulation);
  const explainLoading = useStore((s) => s.explainLoading);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Nudge to save once the first simulation succeeds — dismissible, shown once
  // per session so it never nags on every re-run.
  const [saveNudgeDismissed, setSaveNudgeDismissed] = useState(false);
  const showSaveNudge = !!simResult && !saveNudgeDismissed;

  const loadPreset = (preset) => {
    loadGraph(preset.graph);
    if (preset.load_rps) setLoadRps(preset.load_rps);
    clearSimResult();
  };

  // Right panel tab: follows what the user is doing.
  const [tab, setTab] = useState("inspect");
  useEffect(() => { if (simResult) setTab("results"); }, [simResult]);
  useEffect(() => { if (selectedNodeId) setTab("inspect"); }, [selectedNodeId]);

  // On mobile the palette is a fixed drawer covering the canvas (see
  // Palette.jsx) — start closed there so the canvas is reachable immediately,
  // same first-load behavior as ChallengePlay's brief/build rail.
  useEffect(() => {
    if (window.innerWidth < 1024) setPaletteOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving from a case study / dashboard with a graph to load.
  useEffect(() => {
    const incoming = location.state;
    if (incoming?.graph) {
      loadGraph(incoming.graph);
      if (incoming.loadRps) setLoadRps(incoming.loadRps);
      clearSimResult();
      window.history.replaceState({}, ""); // don't reload it on back/refresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showPanel = selectedNode || simResult;

  return (
    <ReactFlowProvider>
      <div className="h-[calc(100vh-3.5rem)] flex bg-base overflow-hidden relative lg:static">
        {paletteOpen && (
          <>
            <div
              className="fixed inset-0 top-14 z-20 bg-black/50 lg:hidden"
              onClick={() => setPaletteOpen(false)}
              aria-hidden
            />
            <Palette onClose={() => setPaletteOpen(false)} />
          </>
        )}

        {/* Canvas */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setPaletteOpen(!paletteOpen)}
            className="absolute top-3 left-3 z-10 p-2 rounded-lg bg-surface/90 backdrop-blur border border-hairline/[0.08] text-muted hover:text-ink transition-colors"
            aria-label={paletteOpen ? "Hide component palette" : "Show component palette"}
          >
            {paletteOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>

          <SimBar onSave={() => setSaveModalOpen(true)} />

          {simError && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 max-w-md text-center
                            bg-red-500/10 border border-red-500/30 text-red-300 text-[12.5px] rounded-lg px-4 py-2">
              {simError}
            </div>
          )}

          {nodes.length === 0 && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
              <div className="text-center max-w-sm px-6">
                <MousePointerClick size={20} className="mx-auto mb-3 text-muted/60" aria-hidden />
                <p className="text-[13.5px] text-muted leading-relaxed">
                  Drag components from the palette, connect them left to right,
                  then hit <span className="text-ink font-medium">Simulate</span>.
                </p>
                <p className="mt-4 font-mono text-[10.5px] text-muted/50 uppercase tracking-wider">
                  or start from an example
                </p>
                <div className="flex flex-col gap-2 mt-3 pointer-events-auto">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => loadPreset(p)}
                      className="text-left rounded-lg border border-hairline/[0.08] bg-surface/90 backdrop-blur-sm px-3.5 py-2.5
                                 hover:border-indigo-500/35 hover:bg-elevated transition-colors duration-150"
                    >
                      <span className="block text-[12.5px] font-medium text-ink">{p.label}</span>
                      <span className="block text-[11px] text-muted/70 mt-0.5 leading-snug">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Floating "Ask AI" affordance — appears once a result exists, sits
              just above the minimap so it never covers the graph itself. */}
          {simResult && !simRunning && (
            <button
              type="button"
              onClick={explainSimulation}
              disabled={explainLoading}
              aria-label="Ask AI to explain this simulation"
              className="absolute bottom-[11.75rem] right-4 z-10 flex items-center gap-2
                         bg-surface/90 backdrop-blur border border-indigo-500/30 rounded-full pl-3 pr-3.5 py-2
                         text-[12px] font-medium text-indigo-300 shadow-lg shadow-black/30
                         hover:bg-indigo-500/[0.12] hover:border-indigo-500/45 transition-colors disabled:opacity-60"
            >
              {explainLoading
                ? <Loader2 size={13} className="animate-spin" aria-hidden />
                : <Sparkles size={13} aria-hidden />}
              Ask AI
            </button>
          )}

          {showSaveNudge && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3
                             bg-surface/95 backdrop-blur border border-indigo-500/25 rounded-full pl-4 pr-2 py-2
                             shadow-lg shadow-black/30">
              <span className="text-[12.5px] text-ink/90">
                Nice — this design works.{" "}
                <span className="text-muted">Save it before you lose it.</span>
              </span>
              <button
                type="button"
                onClick={() => { setSaveModalOpen(true); setSaveNudgeDismissed(true); }}
                className="text-[12px] font-semibold text-indigo-300 hover:text-indigo-200 px-2.5 py-1 rounded-full hover:bg-indigo-500/10 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setSaveNudgeDismissed(true)}
                aria-label="Dismiss"
                className="text-muted/50 hover:text-ink p-1 rounded-full hover:bg-hairline/[0.06] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <CanvasArea />
        </div>

        {/* Inspector / results — fixed drawer below `lg`, since a phone-width
            viewport has no spare room for a third column next to the canvas. */}
        {showPanel && (
          <>
            <div
              className="fixed inset-0 top-14 z-20 bg-black/50 lg:hidden"
              onClick={() => { selectNode(null); clearSimResult(); }}
              aria-hidden
            />
            <aside className="fixed top-14 bottom-0 right-0 z-30 w-[85%] max-w-[300px] lg:static lg:z-auto
                               shrink-0 h-[calc(100%-3.5rem)] lg:h-full border-l border-hairline/[0.06] bg-surface
                               shadow-2xl shadow-black/40 lg:shadow-none flex flex-col">
              <div className="flex items-center border-b border-hairline/[0.06]" role="tablist">
                <TabButton active={tab === "inspect"} onClick={() => setTab("inspect")} disabled={!selectedNode}>
                  <MousePointerClick size={12} aria-hidden /> Inspect
                </TabButton>
                <TabButton active={tab === "results"} onClick={() => setTab("results")} disabled={!simResult}>
                  <BarChart3 size={12} aria-hidden /> Results
                </TabButton>
                <button
                  type="button"
                  onClick={() => { selectNode(null); clearSimResult(); }}
                  className="lg:hidden shrink-0 p-2 mx-1 rounded-lg text-muted hover:text-ink hover:bg-hairline/[0.06] transition-colors"
                  aria-label="Close panel"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                {tab === "inspect" && selectedNode && <PropertiesPanel node={selectedNode} />}
                {tab === "inspect" && !selectedNode && (
                  <p className="px-4 py-6 text-[12px] text-muted">Select a node to configure it.</p>
                )}
                {tab === "results" && <ResultsPanel />}
              </div>
            </aside>
          </>
        )}

        <LearnDrawer />
        <AIExplainDrawer />
        <SaveDesignModal />
      </div>
    </ReactFlowProvider>
  );
}

function TabButton({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11.5px] font-medium transition-colors
        ${active ? "text-ink border-b-2 border-indigo-500 -mb-px" : "text-muted hover:text-ink"}
        disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
