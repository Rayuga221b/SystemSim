// Component palette: the 14 building blocks, grouped by category.
// Drag onto the canvas, or click to add at a sensible spot. The book icon
// opens the Learn card (theory lives where it's applied).
import { BookOpen, GripVertical, X } from "lucide-react";
import { useStore } from "@/store";
import { COMPONENTS, CATEGORIES } from "@/lib/components";

// Below `lg`, the non-embedded palette becomes a fixed overlay drawer
// instead of a flex sibling — a fixed-width sidebar has no room to share
// with the canvas + inspector panel on a phone-width viewport (see
// Sandbox.jsx / ChallengePlay.jsx for the backdrop that closes it).
export default function Palette({ embedded = false, onClose }) {
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
          : "fixed top-14 bottom-0 left-0 z-30 w-[85%] max-w-[260px] lg:static lg:z-auto lg:w-[232px] " +
            "shrink-0 h-[calc(100%-3.5rem)] lg:h-full overflow-y-auto border-r border-hairline/[0.06] bg-surface shadow-2xl shadow-black/40 lg:shadow-none"
      }
    >
      {!embedded && (
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-medium text-ink">Components</h2>
          <p className="mt-0.5 text-[11px] text-muted leading-snug">
            Drag onto the canvas, connect left → right.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden shrink-0 p-1.5 -m-1 rounded-lg text-muted hover:text-ink hover:bg-hairline/[0.06] transition-colors"
            aria-label="Close component palette"
          >
            <X size={15} />
          </button>
        )}
      </div>
      )}

      {CATEGORIES.map((cat) => (
        <section key={cat.id} className="px-3 pb-1">
          <h3 className="flex items-center gap-1.5 px-1 pt-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
            {cat.label}
          </h3>
          {/* Each row is boxed like a mini version of the canvas node
              (SystemNode.jsx: bordered rounded rectangle, category-colored
              outline) rather than a flat menu row — the palette IS the set of
              nodes you're about to place, so it should look like one. The
              grip icon is the explicit "this is draggable" affordance. */}
          <ul className="flex flex-col gap-1.5 px-0.5">
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
                    style={{ borderColor: `${cat.color}40` }}
                    className="group flex items-center gap-2 rounded-lg border bg-surface px-2 py-[7px] cursor-grab active:cursor-grabbing
                               hover:bg-elevated hover:shadow-sm transition-colors duration-150"
                  >
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}1f` }}
                    >
                      <Icon size={12} style={{ color: cat.color }} aria-hidden />
                    </span>
                    <span className="text-[12.5px] font-medium text-ink/90 leading-tight truncate">{c.label}</span>
                    <span className="ml-auto flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openLearn(c.type); }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted hover:text-indigo-300 transition-opacity p-1 -m-1"
                        aria-label={`Learn about ${c.label}`}
                        title="Theory & real-world usage"
                      >
                        <BookOpen size={13} />
                      </button>
                      <GripVertical size={13} className="text-muted/40 group-hover:text-muted/70 transition-colors" aria-hidden />
                    </span>
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
