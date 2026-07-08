// Component palette: the 14 building blocks, grouped by category.
// Drag onto the canvas, or click to add at a sensible spot. The book icon
// opens the Learn card (theory lives where it's applied).
import { BookOpen } from "lucide-react";
import { useStore } from "@/store";
import { COMPONENTS, CATEGORIES } from "@/lib/components";

export default function Palette({ embedded = false }) {
  const addNode = useStore((s) => s.addNode);
  const openLearn = useStore((s) => s.openLearn);
  const nodeCount = useStore((s) => s.nodes.length);

  const clickAdd = (type) => {
    // Stagger click-added nodes so they don't stack perfectly.
    addNode(type, { x: 120 + (nodeCount % 4) * 60, y: 120 + (nodeCount % 6) * 48 });
  };

  return (
    <aside
      className={
        embedded
          ? "w-full h-full overflow-y-auto"
          : "w-[232px] shrink-0 h-full overflow-y-auto border-r border-white/[0.06] bg-surface/95"
      }
    >
      {!embedded && (
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-medium text-ink">Components</h2>
        <p className="mt-0.5 text-[11px] text-muted leading-snug">
          Drag onto the canvas, connect left → right.
        </p>
      </div>
      )}

      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="px-3 pb-1">
          <h3 className="flex items-center gap-1.5 px-1 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
            {cat.label}
          </h3>
          {/* Flat list rows — dot + icon + label, no card/border chrome.
              Matches the proposed sidebar concept (design/systemsim-design-
              portfolio.html): grouped by category, quiet until hovered. */}
          <ul className="flex flex-col gap-0.5 px-0.5">
            {COMPONENTS.filter((c) => c.category === cat.id).map((c) => {
              const Icon = c.icon;
              return (
                <li key={c.type}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/systemsim-node", c.type);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => clickAdd(c.type)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickAdd(c.type); }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Add ${c.label}`}
                    title={c.description}
                    className="group flex items-center gap-2 rounded-lg px-2 py-[7px] cursor-grab active:cursor-grabbing
                               hover:bg-elevated transition-colors duration-150"
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}1f` }}
                    >
                      <Icon size={12} style={{ color: cat.color }} aria-hidden />
                    </span>
                    <span className="text-[12.5px] font-medium text-ink/90 leading-tight truncate">{c.label}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openLearn(c.type); }}
                      className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted hover:text-indigo-300 transition-opacity p-1 -m-1 shrink-0"
                      aria-label={`Learn about ${c.label}`}
                      title="Theory & real-world usage"
                    >
                      <BookOpen size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="h-6" />
    </aside>
  );
}
