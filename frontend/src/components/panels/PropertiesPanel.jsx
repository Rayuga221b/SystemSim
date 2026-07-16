// Inspect + configure the selected node: editable label, config fields with
// sensible controls, failure injection toggles, learn link, delete.
import { BookOpen, Trash2 } from "lucide-react";
import { useStore } from "@/store";
import { COMPONENT_BY_TYPE, CATEGORY_COLOR, capacitySummary } from "@/lib/components";
import { failuresFor } from "@/lib/failures";

export default function PropertiesPanel({ node }) {
  const updateNodeConfig = useStore((s) => s.updateNodeConfig);
  const renameNode = useStore((s) => s.renameNode);
  const removeNode = useStore((s) => s.removeNode);
  const openLearn = useStore((s) => s.openLearn);
  const failures = useStore((s) => s.failures);
  const toggleFailure = useStore((s) => s.toggleFailure);

  const comp = COMPONENT_BY_TYPE[node.data.type];
  if (!comp) return null;
  const Icon = comp.icon;
  const color = CATEGORY_COLOR[comp.category];
  const config = { ...node.data.config };
  const modes = failuresFor(node.data.type);
  const activeFailure = failures[node.id];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-hairline/[0.06]">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
            <Icon size={15} style={{ color }} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={node.data.label}
              onChange={(e) => renameNode(node.id, e.target.value)}
              className="w-full bg-transparent text-[13.5px] font-medium text-ink outline-none
                         border-b border-transparent focus:border-indigo-500/50 pb-0.5"
              aria-label="Node name"
            />
            <p className="font-mono text-[10px] text-muted mt-0.5">{comp.label}</p>
          </div>
        </div>
        <p className="mt-2.5 text-[11.5px] text-muted leading-relaxed">{comp.description}</p>
        <button
          type="button"
          onClick={() => openLearn(comp.type)}
          className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-indigo-300 hover:text-indigo-200"
        >
          <BookOpen size={12} /> Theory & real-world usage
        </button>
      </div>

      {/* Config */}
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        {comp.fields.length > 0 ? (
          <>
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2.5">Configuration</h3>
            <div className="flex flex-col gap-3.5">
              {comp.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex items-baseline justify-between mb-1">
                    <span className="text-[12px] text-ink/90">{f.label}</span>
                    <span className="font-mono text-[11px] text-indigo-300 tabular-nums">
                      {config[f.key]}{f.unit && ` ${f.unit}`}
                    </span>
                  </span>
                  {f.type === "percent" ? (
                    <input
                      type="range" min={f.min} max={f.max} step={f.step}
                      value={config[f.key]}
                      onChange={(e) => updateNodeConfig(node.id, f.key, +e.target.value)}
                      className="w-full accent-indigo-500"
                      aria-label={f.label}
                    />
                  ) : (
                    <input
                      type="number" min={f.min} max={f.max} step={f.step}
                      value={config[f.key]}
                      onChange={(e) => {
                        const v = e.target.value === "" ? f.min : +e.target.value;
                        updateNodeConfig(node.id, f.key, v);
                      }}
                      className="w-full bg-elevated border border-hairline/[0.08] rounded-lg px-2.5 py-1.5
                                 font-mono text-[12px] text-ink outline-none focus:border-indigo-500/60"
                      aria-label={f.label}
                    />
                  )}
                  {f.help && <span className="block mt-1 text-[10.5px] text-muted/80 leading-snug">{f.help}</span>}
                </label>
              ))}
            </div>
            <p className="mt-3 font-mono text-[10.5px] text-muted/70 border-t border-hairline/[0.05] pt-2.5">
              → {capacitySummary(node.data.type, config)}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted">Nothing to configure — this node {comp.type === "client" ? "emits the load you set in the toolbar" : "uses fixed behavior"}.</p>
        )}

        {/* Failure injection */}
        {modes.length > 0 && (
          <div className="mt-5">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-1">Chaos</h3>
            <p className="text-[10.5px] text-muted/80 mb-2.5 leading-snug">Inject a failure, re-run, watch the blast radius.</p>
            <div className="flex flex-col gap-1.5">
              {modes.map((m) => {
                const active = activeFailure === m.mode;
                return (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => toggleFailure(node.id, m.mode)}
                    aria-pressed={active}
                    className={`text-left px-2.5 py-2 rounded-lg border transition-colors duration-150 ${
                      active
                        ? "border-amber-400/50 bg-amber-400/10"
                        : "border-hairline/[0.07] hover:border-hairline/[0.14] hover:bg-elevated"
                    }`}
                  >
                    <span className={`block text-[12px] ${active ? "text-amber-300" : "text-ink/90"}`}>
                      {m.label} {active && "· armed"}
                    </span>
                    <span className="block text-[10.5px] text-muted leading-snug mt-0.5">{m.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-hairline/[0.06]">
        <button
          type="button"
          onClick={() => removeNode(node.id)}
          className="flex items-center gap-1.5 text-[12px] text-muted hover:text-red-400 transition-colors"
        >
          <Trash2 size={13} /> Remove node
        </button>
      </div>
    </div>
  );
}
