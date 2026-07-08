// Sandbox — the hero of the product. Palette | canvas | inspector, with the
// simulation bar floating over the canvas. The canvas is the star; chrome recedes.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ReactFlowProvider } from "reactflow";
import { PanelLeftClose, PanelLeftOpen, MousePointerClick, BarChart3 } from "lucide-react";
import { useStore } from "@/store";
import CanvasArea from "@/components/canvas/CanvasArea";
import SimBar from "@/components/canvas/SimBar";
import Palette from "@/components/sidebar/Palette";
import PropertiesPanel from "@/components/panels/PropertiesPanel";
import ResultsPanel from "@/components/panels/ResultsPanel";
import LearnDrawer from "@/components/panels/LearnDrawer";
import SaveDesignModal from "@/components/panels/SaveDesignModal";

export default function Sandbox() {
  const location = useLocation();
  const nodes = useStore((s) => s.nodes);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const simResult = useStore((s) => s.simResult);
  const simError = useStore((s) => s.simError);
  const loadGraph = useStore((s) => s.loadGraph);
  const setLoadRps = useStore((s) => s.setLoadRps);
  const clearSimResult = useStore((s) => s.clearSimResult);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Right panel tab: follows what the user is doing.
  const [tab, setTab] = useState("inspect");
  useEffect(() => { if (simResult) setTab("results"); }, [simResult]);
  useEffect(() => { if (selectedNodeId) setTab("inspect"); }, [selectedNodeId]);

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
      <div className="h-[calc(100vh-3.5rem)] flex bg-base overflow-hidden">
        {paletteOpen && <Palette />}

        {/* Canvas */}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setPaletteOpen(!paletteOpen)}
            className="absolute top-3 left-3 z-10 p-2 rounded-lg bg-surface/90 backdrop-blur border border-white/[0.08] text-muted hover:text-ink transition-colors"
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
              <div className="text-center max-w-xs">
                <MousePointerClick size={20} className="mx-auto mb-3 text-muted/60" aria-hidden />
                <p className="text-[13.5px] text-muted leading-relaxed">
                  Drag components from the palette, connect them left to right,
                  then hit <span className="text-ink font-medium">Simulate</span>.
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted/60">
                  or load an example from the toolbar ↑
                </p>
              </div>
            </div>
          )}

          <CanvasArea />
        </div>

        {/* Inspector / results */}
        {showPanel && (
          <aside className="w-[300px] shrink-0 h-full border-l border-white/[0.06] bg-surface/95 flex flex-col">
            <div className="flex border-b border-white/[0.06]" role="tablist">
              <TabButton active={tab === "inspect"} onClick={() => setTab("inspect")} disabled={!selectedNode}>
                <MousePointerClick size={12} aria-hidden /> Inspect
              </TabButton>
              <TabButton active={tab === "results"} onClick={() => setTab("results")} disabled={!simResult}>
                <BarChart3 size={12} aria-hidden /> Results
              </TabButton>
            </div>
            <div className="flex-1 min-h-0">
              {tab === "inspect" && selectedNode && <PropertiesPanel node={selectedNode} />}
              {tab === "inspect" && !selectedNode && (
                <p className="px-4 py-6 text-[12px] text-muted">Select a node to configure it.</p>
              )}
              {tab === "results" && <ResultsPanel />}
            </div>
          </aside>
        )}

        <LearnDrawer />
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
