// The single custom React Flow node. Which system component it represents
// lives in node.data.type — all visuals derive from lib/components metadata.
import { memo } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle2, AlertTriangle, AlertOctagon, XCircle, Bug } from "lucide-react";
import { useStore } from "@/store";
import { COMPONENT_BY_TYPE, CATEGORY_COLOR, capacitySummary, fmt } from "@/lib/components";
import { FAILURE_MODES } from "@/lib/failures";

// Status is never conveyed by color alone (a11y): each status pairs an icon.
// "healthy" uses mint (the second brand accent, reserved for "healthy /
// simulating" states only — see DESIGN.md "Visual rebrand" note).
const STATUS = {
  healthy:    { icon: CheckCircle2,  ring: "border-mint/60",      text: "text-mint",        label: "Healthy" },
  warning:    { icon: AlertTriangle, ring: "border-amber-400/70", text: "text-amber-400",   label: "Near capacity" },
  overloaded: { icon: AlertOctagon,  ring: "border-red-500/80",   text: "text-red-400",     label: "Overloaded" },
  failed:     { icon: XCircle,       ring: "border-red-600/80",   text: "text-red-500",     label: "Failed" },
};

function SystemNode({ id, data, selected }) {
  const comp = COMPONENT_BY_TYPE[data.type];
  const status = useStore((s) => s.simResult?.node_statuses?.[id]);
  const metrics = useStore((s) => s.simResult?.node_metrics?.[id]);
  const failure = useStore((s) => s.failures[id]);

  if (!comp) return null;
  const Icon = comp.icon;
  const color = CATEGORY_COLOR[comp.category];
  const st = status ? STATUS[status] : null;
  const StatusIcon = st?.icon;
  const util = metrics ? Math.min(metrics.utilization_pct, 100) : null;

  // Idle nodes (no sim result yet, not selected) get a category-colored
  // outline instead of a neutral border — you can tell what a node *is* at a
  // glance before you ever hit Simulate. Once a status or selection exists,
  // that takes over via the Tailwind classes below (inline style would win
  // the cascade otherwise).
  const idleOutline = !st && !selected ? { borderColor: `${color}80` } : undefined;

  return (
    <div
      style={idleOutline}
      className={`group w-[178px] rounded-lg bg-surface border-2 transition-colors duration-150
        ${st ? st.ring : ""}
        ${selected ? "shadow-indigo-ring border-indigo-500/60" : ""}
        ${status === "failed" ? "opacity-70" : ""}`}
    >
      {data.type !== "client" && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-elevated !border !border-indigo-400/60 hover:!bg-indigo-500"
        />
      )}

      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}1f` }}
          >
            <Icon size={13} style={{ color }} aria-hidden />
          </span>
          <span className="text-[12.5px] font-medium text-ink leading-tight truncate">
            {data.label}
          </span>
          {st && (
            <span className={`ml-auto shrink-0 ${st.text}`} title={st.label} aria-label={st.label}>
              <StatusIcon size={14} />
            </span>
          )}
        </div>

        <p className="mt-1.5 font-mono text-[9.5px] text-muted leading-snug">
          {capacitySummary(data.type, data.config)}
        </p>

        {metrics && (
          <p className="mt-1 font-mono text-[9.5px] text-muted/80">
            in {fmt(metrics.in_rps)} → out {fmt(metrics.out_rps)}
            {util != null && ` · ${Math.round(metrics.utilization_pct)}%`}
          </p>
        )}

        {failure && (
          <p className="mt-1 flex items-center gap-1 font-mono text-[9.5px] text-amber-400">
            <Bug size={10} aria-hidden /> {FAILURE_MODES[failure]?.label || failure}
          </p>
        )}
      </div>

      {/* Utilization bar — only after a simulation */}
      {util != null && (
        <div className="h-[3px] mx-[1px] mb-[1px] rounded-b-lg bg-hairline/[0.04] overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              status === "overloaded" || status === "failed"
                ? "bg-red-500"
                : status === "warning"
                ? "bg-amber-400"
                : "bg-mint/80"
            }`}
            style={{ width: `${util}%` }}
          />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-elevated !border !border-indigo-400/60 hover:!bg-indigo-500"
      />
    </div>
  );
}

export default memo(SystemNode);
