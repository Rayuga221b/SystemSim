export default function Sandbox() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-base flex items-center justify-center px-6">
      <div className="text-center">
        <div className="w-12 h-12 rounded-xl bg-elevated border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
          <span className="font-mono text-indigo-400/70 text-[11px]">04</span>
        </div>
        <h2 className="font-display font-semibold text-[1.5rem] text-ink mb-2.5">The Canvas</h2>
        <p className="text-muted text-sm">Drag-and-drop system design, coming in Phase 4.</p>
      </div>
    </div>
  );
}
