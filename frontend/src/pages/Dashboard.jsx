// Your workspace: saved designs and challenge attempt history.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  PenTool, Trophy, LogOut, Trash2, ArrowRight, Layout, Loader2,
} from "lucide-react";
import { useStore } from "@/store";
import { api } from "@/api/client";

const MODE_BADGE = {
  sandbox:   "text-indigo-300 border-indigo-500/25 bg-indigo-500/[0.08]",
  challenge: "text-amber-300 border-amber-400/25 bg-amber-400/[0.08]",
  casestudy: "text-sky-300 border-sky-400/25 bg-sky-400/[0.08]",
};

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Dashboard() {
  const user = useStore((s) => s.user);
  const authReady = useStore((s) => s.authReady);
  const logout = useStore((s) => s.logout);
  const loadGraph = useStore((s) => s.loadGraph);
  const navigate = useNavigate();

  const [designs, setDesigns] = useState(null);
  const [attempts, setAttempts] = useState(null);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.listDesigns().then((d) => setDesigns(d.designs || d)).catch((e) => setError(e.message));
    api.myAttempts().then((a) => setAttempts(a.attempts || a)).catch(() => setAttempts([]));
  }, [user]);

  if (!authReady) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-base">
        <Loader2 size={18} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-base px-6">
        <div className="text-center max-w-sm">
          <Layout size={22} className="mx-auto mb-4 text-muted/60" aria-hidden />
          <h1 className="font-display font-semibold text-[1.5rem] text-ink mb-2">Your workspace</h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            Sign in to save designs, track your challenge scores, and pick up where you left off.
          </p>
          <Link to="/login" className="btn-primary inline-block text-white text-[13.5px] font-medium rounded-lg px-6 py-2.5">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const bestScore = attempts?.length ? Math.max(...attempts.map((a) => a.score ?? 0)) : null;

  const openDesign = (design) => {
    loadGraph(design.graph_json);
    navigate("/sandbox");
  };

  const deleteDesign = async (id) => {
    setDeleting(id);
    try {
      await api.deleteDesign(id);
      setDesigns((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="py-14 sm:py-16 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">Workspace</p>
            <h1 className="font-display font-semibold text-3xl sm:text-4xl text-ink mb-2">Welcome back</h1>
            <p className="text-muted text-sm">{user.email}</p>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <Stat value={designs?.length ?? "—"} label="Designs" />
            <div className="w-px h-9 bg-white/[0.06]" />
            <Stat value={attempts?.length ?? "—"} label="Attempts" />
            <div className="w-px h-9 bg-white/[0.06]" />
            <Stat value={bestScore ?? "—"} label="Best score" accent />
            <button
              type="button"
              onClick={logout}
              className="ml-2 p-2 rounded-lg text-muted hover:text-ink hover:bg-elevated transition-colors"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {error && <p className="mt-6 text-[13px] text-red-400">{error}</p>}

        {/* Designs */}
        <section className="pt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink">
              <PenTool size={15} className="text-indigo-400" aria-hidden /> Saved designs
            </h2>
            <Link to="/sandbox" className="text-[12.5px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1">
              New design <ArrowRight size={12} />
            </Link>
          </div>

          {designs === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />)}
            </div>
          ) : designs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
              <p className="text-muted text-sm mb-3">No designs yet — your saved canvases will live here.</p>
              <Link to="/sandbox" className="text-indigo-300 text-[13px] hover:text-indigo-200">Open the sandbox →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {designs.map((d) => (
                <div
                  key={d.id}
                  className="group flex items-center gap-4 bg-surface border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-elevated/60 transition-colors"
                >
                  <button type="button" onClick={() => openDesign(d)} className="flex-1 min-w-0 text-left">
                    <span className="block text-[13.5px] font-medium text-ink truncate group-hover:text-indigo-200 transition-colors">
                      {d.title}
                    </span>
                    <span className="block font-mono text-[10.5px] text-muted/60 mt-0.5">
                      {d.graph_json?.nodes?.length ?? 0} components · updated {fmtDate(d.updated_at)}
                    </span>
                  </button>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded border shrink-0 ${MODE_BADGE[d.mode] || MODE_BADGE.sandbox}`}>
                    {d.mode}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteDesign(d.id)}
                    disabled={deleting === d.id}
                    className="p-1.5 rounded text-muted/50 hover:text-red-400 transition-colors disabled:opacity-40"
                    aria-label={`Delete ${d.title}`}
                  >
                    {deleting === d.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Attempts */}
        <section className="pt-12 pb-24">
          <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-4">
            <Trophy size={15} className="text-amber-400" aria-hidden /> Challenge attempts
          </h2>

          {attempts === null ? (
            <div className="h-16 rounded-xl bg-surface animate-pulse" />
          ) : attempts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
              <p className="text-muted text-sm mb-3">No attempts yet — get scored on a real scenario.</p>
              <Link to="/challenges" className="text-indigo-300 text-[13px] hover:text-indigo-200">Browse challenges →</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {attempts.slice(0, 10).map((a) => {
                const tone = a.score >= 80 ? "text-emerald-400" : a.score >= 50 ? "text-amber-400" : "text-red-400";
                return (
                  <Link
                    key={a.id}
                    to={`/challenges/${a.challenge_slug}`}
                    className="flex items-center gap-4 bg-surface border border-white/[0.06] rounded-xl px-4 py-3 hover:bg-elevated/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-medium text-ink truncate">{a.challenge_title || a.challenge_slug}</span>
                      <span className="block font-mono text-[10.5px] text-muted/60 mt-0.5">{fmtDate(a.attempted_at)}</span>
                    </div>
                    <span className={`font-display font-bold text-[1.35rem] tabular-nums ${tone}`}>
                      {a.score}
                      <span className="text-[11px] font-sans font-normal text-muted">/100</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function Stat({ value, label, accent }) {
  return (
    <div className="text-right">
      <p className={`font-display text-2xl font-bold leading-none mb-1.5 ${accent ? "text-amber-400" : "text-ink"}`}>{value}</p>
      <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">{label}</p>
    </div>
  );
}
