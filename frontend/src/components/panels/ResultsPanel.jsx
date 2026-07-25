// Simulation results: verdict, bottlenecks, tradeoff profile, warnings, and
// the AI "explain my design" hook. Readable at a glance — no decoding needed.
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, AlertOctagon, XCircle } from "lucide-react";
import { useStore } from "@/store";
import { fmt } from "@/lib/components";

const STATUS_META = {
  healthy:    { icon: CheckCircle2,  cls: "text-emerald-400" },
  warning:    { icon: AlertTriangle, cls: "text-amber-400" },
  overloaded: { icon: AlertOctagon,  cls: "text-red-400" },
  failed:     { icon: XCircle,       cls: "text-red-500" },
};

const TRADEOFF_LABELS = {
  consistency: "Consistency",
  availability: "Availability",
  scalability: "Scalability",
  latency: "Latency",
};

export default function ResultsPanel() {
  const result = useStore((s) => s.simResult);
  const nodes = useStore((s) => s.nodes);
  const selectNode = useStore((s) => s.selectNode);
  const explainSimulation = useStore((s) => s.explainSimulation);
  const explainLoading = useStore((s) => s.explainLoading);
  const explanation = useStore((s) => s.explanation);

  if (!result) return null;

  const requested = result.throughput_requested_rps;
  const achieved = result.throughput_achieved_rps;
  const successPct = requested > 0 ? Math.round((achieved / requested) * 100) : 0;
  const nodeLabel = (id) => nodes.find((n) => n.id === id)?.data.label || id;
  const statusCounts = Object.values(result.node_statuses || {}).reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const verdictTone =
    successPct >= 99 ? "text-emerald-400" : successPct >= 80 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Verdict */}
      <div className="px-4 pt-4 pb-3 border-b border-hairline/[0.06]">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2">Verdict</h3>
        <p className={`font-display text-[1.75rem] font-semibold leading-none tabular-nums ${verdictTone}`}>
          {successPct}%
          <span className="text-[12px] font-sans font-normal text-muted ml-2">of traffic served</span>
        </p>
        <p className="mt-2 font-mono text-[11px] text-muted tabular-nums">
          {fmt(achieved)} / {fmt(requested)} rps · {Math.round(result.critical_path_latency_ms)}ms critical path
        </p>
        <div className="flex items-center gap-3 mt-2.5">
          {Object.entries(STATUS_META).map(([key, meta]) => {
            if (!statusCounts[key]) return null;
            const Icon = meta.icon;
            return (
              <span key={key} className={`flex items-center gap-1 font-mono text-[11px] ${meta.cls}`}>
                <Icon size={12} aria-hidden /> {statusCounts[key]} {key}
              </span>
            );
          })}
        </div>
      </div>

      {/* Bottlenecks */}
      {result.bottlenecks?.length > 0 && (
        <div className="px-4 py-3 border-b border-hairline/[0.06]">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2">Bottlenecks</h3>
          <div className="flex flex-col gap-1.5">
            {result.bottlenecks.map((id) => {
              const m = result.node_metrics?.[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectNode(id)}
                  className="text-left px-2.5 py-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] hover:bg-red-500/10 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-[12.5px] text-red-300">
                    <AlertOctagon size={13} aria-hidden /> {nodeLabel(id)}
                  </span>
                  {m && (
                    <span className="block font-mono text-[10.5px] text-muted mt-0.5 tabular-nums">
                      {fmt(m.in_rps)} rps in · capacity {fmt(m.capacity_rps)} · {Math.round(m.utilization_pct)}% utilized
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tradeoffs */}
      <div className="px-4 py-3 border-b border-hairline/[0.06]">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2.5">Tradeoff profile</h3>
        <div className="flex flex-col gap-2.5">
          {Object.entries(TRADEOFF_LABELS).map(([key, label]) => {
            const v = result.tradeoffs?.[key] ?? 0;
            return (
              <div key={key}>
                <span className="flex items-baseline justify-between mb-1">
                  <span className="text-[11.5px] text-ink/85">{label}</span>
                  <span className="font-mono text-[10.5px] text-muted tabular-nums">{Math.round(v)}</span>
                </span>
                <div className="h-1.5 rounded-full bg-hairline/[0.05] overflow-hidden" role="img" aria-label={`${label}: ${Math.round(v)} out of 100`}>
                  <div className="h-full rounded-full bg-indigo-500/80 transition-all duration-300" style={{ width: `${v}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Chip label="cost" value={result.tradeoffs?.cost} />
          <Chip label="complexity" value={result.tradeoffs?.complexity} />
        </div>
      </div>

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div className="px-4 py-3 border-b border-hairline/[0.06]">
          <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2">Warnings</h3>
          <ul className="flex flex-col gap-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] text-amber-200/90 leading-snug">
                <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      </div>

      {/* AI explain — fixed footer so it's reachable however long the results
          get; opens the walkthrough drawer (loading/error handled there). */}
      <div className="shrink-0 px-4 py-3 border-t border-hairline/[0.06] bg-surface/95">
        <button
          type="button"
          onClick={explainSimulation}
          disabled={explainLoading}
          className="w-full flex items-center justify-center gap-2 border border-indigo-500/30 bg-indigo-500/[0.08]
                     hover:bg-indigo-500/[0.14] text-indigo-300 text-[12.5px] font-medium rounded-lg px-3 py-2
                     transition-colors disabled:opacity-50"
        >
          {explainLoading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
          {explainLoading ? "Thinking…" : explanation ? "View AI walkthrough" : "Explain my design"}
        </button>
      </div>
    </div>
  );
}

function Chip({ label, value }) {
  if (!value) return null;
  const tone = { low: "text-emerald-400 border-emerald-500/25", medium: "text-amber-400 border-amber-400/25", high: "text-red-400 border-red-500/25" }[value] || "text-muted border-hairline/[0.1]";
  return (
    <span className={`font-mono text-[10px] px-2 py-1 rounded border ${tone}`}>
      {label}: {value}
    </span>
  );
}
