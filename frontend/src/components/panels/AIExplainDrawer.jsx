// The AI walkthrough drawer: structured explanation of the last simulation —
// verdict summary, per-bottleneck WHY + fix, and next steps. Opens from the
// results panel button or the canvas "Ask AI" pill. All fetch state lives in
// simulationSlice; this component only renders it (loading / error / result).
import { useEffect } from "react";
import {
  X, Sparkles, Loader2, AlertOctagon, Wrench, ListChecks, RefreshCw, CheckCircle2,
} from "lucide-react";
import { useStore } from "@/store";

export default function AIExplainDrawer() {
  const open = useStore((s) => s.explainOpen);
  const setOpen = useStore((s) => s.setExplainOpen);
  const explanation = useStore((s) => s.explanation);
  const loading = useStore((s) => s.explainLoading);
  const error = useStore((s) => s.explainError);
  const explainSimulation = useStore((s) => s.explainSimulation);
  const selectNode = useStore((s) => s.selectNode);
  const nodes = useStore((s) => s.nodes);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  // "Show on canvas" only for nodes that still exist (the graph may have
  // been edited since the explanation was fetched).
  const nodeExists = (id) => nodes.some((n) => n.id === id);
  const locate = (id) => {
    selectNode(id);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="AI explanation of your simulation"
    >
      <div className="w-[440px] max-w-full h-full bg-surface border-l border-hairline/[0.08] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-hairline/[0.06] px-6 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-500/15">
            <Sparkles size={17} className="text-indigo-300" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-semibold text-ink leading-tight">AI walkthrough</h2>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mt-0.5">Why this result happened</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink p-1.5 -m-1.5" aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-14 text-center" aria-live="polite">
              <Loader2 size={20} className="animate-spin text-indigo-300" aria-hidden />
              <p className="text-[12.5px] text-muted leading-relaxed max-w-[16rem]">
                Reading your architecture and the simulation numbers…
              </p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-hairline/[0.09] bg-elevated px-4 py-4" aria-live="polite">
              <p className="text-[12.5px] text-ink/85 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={explainSimulation}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-indigo-300 hover:text-indigo-200"
              >
                <RefreshCw size={12} aria-hidden /> Try again
              </button>
            </div>
          )}

          {!loading && !error && explanation && (
            <>
              {/* Verdict — bright lede, same treatment as the Learn drawer */}
              <p className="text-[14px] text-ink leading-relaxed border-l-2 border-indigo-500/60 pl-3.5">
                {explanation.summary}
              </p>

              {explanation.bottlenecks?.length > 0 ? (
                <Section icon={AlertOctagon} title="Why it bottlenecks" color="#F87171">
                  <div className="flex flex-col gap-3">
                    {explanation.bottlenecks.map((b, i) => (
                      <div key={b.node_id || i} className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-300">
                            <AlertOctagon size={13} aria-hidden /> {b.label}
                          </span>
                          {nodeExists(b.node_id) && (
                            <button
                              type="button"
                              onClick={() => locate(b.node_id)}
                              className="text-[11px] text-muted hover:text-ink underline underline-offset-2 decoration-hairline/40"
                            >
                              Show on canvas
                            </button>
                          )}
                        </div>
                        <p className="mt-1.5 text-[12.5px] text-ink/85 leading-relaxed">{b.why}</p>
                        <p className="mt-2 flex gap-2 text-[12.5px] text-emerald-300/90 leading-relaxed">
                          <Wrench size={13} className="shrink-0 mt-0.5 text-emerald-400" aria-hidden />
                          {b.fix}
                        </p>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : (
                <Section icon={CheckCircle2} title="No bottlenecks" color="#34D399">
                  <p className="text-[12.5px] text-muted leading-relaxed">
                    This design held up at the simulated load — see below for how to stress it further.
                  </p>
                </Section>
              )}

              {explanation.suggested_fixes?.length > 0 && (
                <Section icon={ListChecks} title="Next steps" color="#9B85FF">
                  <ol className="flex flex-col gap-1.5">
                    {explanation.suggested_fixes.map((f, i) => (
                      <li key={i} className="flex gap-2.5 text-[12.5px] text-ink/85 leading-relaxed">
                        <span className="font-mono text-[10px] text-indigo-400/80 mt-[3px] shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {f}
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              <p className="text-[10.5px] text-muted/60 leading-relaxed border-t border-hairline/[0.04] pt-4">
                AI-generated from your exact graph and simulation numbers. Change the design and re-simulate for a fresh read.
              </p>
            </>
          )}

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <section className="border-t border-hairline/[0.04] pt-5 first:border-0 first:pt-0">
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/80 mb-2">
        <Icon size={12} style={{ color }} aria-hidden /> {title}
      </h3>
      {children}
    </section>
  );
}
