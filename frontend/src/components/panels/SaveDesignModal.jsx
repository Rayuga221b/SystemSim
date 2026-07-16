// Save the current canvas as a named design. Requires a session — points to
// /login otherwise. Saves full React Flow nodes (positions included) so the
// layout restores exactly.
import { useState } from "react";
import { Link } from "react-router-dom";
import { X, Loader2, Check } from "lucide-react";
import { useStore } from "@/store";
import { api } from "@/api/client";

export default function SaveDesignModal({ mode = "sandbox" }) {
  const open = useStore((s) => s.saveModalOpen);
  const setOpen = useStore((s) => s.setSaveModalOpen);
  const user = useStore((s) => s.user);
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);

  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  if (!open) return null;

  const close = () => { setOpen(false); setSaved(false); setError(null); };

  const save = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createDesign(title.trim(), mode, { nodes, edges });
      setSaved(true);
      setTimeout(close, 900);
    } catch (err) {
      setError(err.detail || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && close()}
      role="dialog"
      aria-modal="true"
      aria-label="Save design"
    >
      <div className="w-[380px] bg-surface border border-hairline/[0.09] rounded-xl p-5 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-medium text-ink">Save design</h2>
          <button type="button" onClick={close} className="text-muted hover:text-ink p-1 -m-1" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {!user ? (
          <div>
            <p className="text-[13px] text-muted leading-relaxed">
              Sign in to save designs to your dashboard and pick them up later.
            </p>
            <Link
              to="/login"
              onClick={close}
              className="btn-primary block text-center text-white text-[13px] font-medium rounded-lg px-4 py-2 mt-4"
            >
              Sign in
            </Link>
          </div>
        ) : saved ? (
          <p className="flex items-center gap-2 text-[13px] text-emerald-400 py-2">
            <Check size={15} /> Saved to your dashboard.
          </p>
        ) : (
          <form onSubmit={save}>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. URL shortener v2 — with cache"
              className="w-full bg-elevated border border-hairline/[0.08] rounded-lg px-3 py-2 text-[13px] text-ink
                         placeholder:text-muted/60 outline-none focus:border-indigo-500/60"
              aria-label="Design title"
            />
            {error && <p className="mt-2 text-[12px] text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 text-white text-[13px] font-medium
                         rounded-lg px-4 py-2 mt-3 disabled:opacity-40"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
