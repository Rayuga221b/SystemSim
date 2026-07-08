// Challenge workspace: brief + components on the left, canvas center,
// inspector/results right. Build → simulate → submit → scored feedback.
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ReactFlowProvider } from "reactflow";
import { useReducedMotion } from "framer-motion";
import {
  ArrowLeft, ClipboardList, Blocks, Lightbulb, Loader2, Send, Eye, Target,
  CheckCircle2, AlertTriangle, XCircle, MousePointerClick, BarChart3, RotateCcw, Trophy,
} from "lucide-react";
import { useStore } from "@/store";
import { api } from "@/api/client";
import { fmt } from "@/lib/components";
import { DIFFICULTY_BADGE } from "@/data/constants";
import CanvasArea from "@/components/canvas/CanvasArea";
import SimBar from "@/components/canvas/SimBar";
import Palette from "@/components/sidebar/Palette";
import PropertiesPanel from "@/components/panels/PropertiesPanel";
import ResultsPanel from "@/components/panels/ResultsPanel";
import LearnDrawer from "@/components/panels/LearnDrawer";
import SaveDesignModal from "@/components/panels/SaveDesignModal";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function ChallengePlay() {
  const { slug } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [leftTab, setLeftTab] = useState("brief"); // brief | build
  const [hintsShown, setHintsShown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(null); // {score, feedback}
  const [submitError, setSubmitError] = useState(null);

  const user = useStore((s) => s.user);
  const nodes = useStore((s) => s.nodes);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const simResult = useStore((s) => s.simResult);
  const simError = useStore((s) => s.simError);
  const serializeGraph = useStore((s) => s.serializeGraph);
  const loadGraph = useStore((s) => s.loadGraph);
  const clearCanvas = useStore((s) => s.clearCanvas);
  const clearSimResult = useStore((s) => s.clearSimResult);
  const clearFailures = useStore((s) => s.clearFailures);
  const setLoadRps = useStore((s) => s.setLoadRps);
  const setReadPct = useStore((s) => s.setReadPct);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const [rightTab, setRightTab] = useState("inspect");
  useEffect(() => { if (simResult) setRightTab("results"); }, [simResult]);
  useEffect(() => { if (selectedNodeId) setRightTab("inspect"); }, [selectedNodeId]);

  // Best score before this session's attempts — captured once on load so a
  // "New best!" badge can compare against it after a fresh submission.
  const [priorBest, setPriorBest] = useState(null);
  useEffect(() => {
    if (!user) { setPriorBest(null); return; }
    api.listMyAttempts(slug)
      .then((data) => {
        const list = data.attempts || data;
        setPriorBest(list.length ? Math.max(...list.map((a) => a.score ?? 0)) : null);
      })
      .catch(() => setPriorBest(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user]);

  // Load the challenge; start from a clean canvas tuned to its traffic.
  useEffect(() => {
    let alive = true;
    setChallenge(null);
    setAttempt(null);
    setHintsShown(0);
    api.getChallenge(slug)
      .then((c) => {
        if (!alive) return;
        setChallenge(c);
        clearCanvas();
        clearSimResult();
        clearFailures();
        if (c.load_rps) setLoadRps(c.load_rps);
        if (c.workload?.read_pct != null) setReadPct(c.workload.read_pct);
      })
      .catch((e) => alive && setLoadError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.attemptChallenge(slug, serializeGraph());
      setAttempt(res);
    } catch (e) {
      setSubmitError(e.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const [solutionNote, setSolutionNote] = useState(null);
  const [peekConfirm, setPeekConfirm] = useState(false);
  const showSolution = async () => {
    const sol = await api.getChallengeSolution(slug);
    loadGraph(sol.reference_graph);
    if (sol.load_rps) setLoadRps(sol.load_rps);
    clearSimResult();
    clearFailures();
    setSolutionNote(sol.note);
    setPeekConfirm(false);
  };

  if (loadError) {
    return (
      <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center bg-base px-6">
        <div className="text-center">
          <p className="text-muted text-sm mb-4">{loadError}</p>
          <Link to="/challenges" className="text-indigo-300 text-sm hover:text-indigo-200">← Back to challenges</Link>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-[calc(100vh-3.5rem)] flex bg-base overflow-hidden">
        {/* Left: brief / build */}
        <aside className="w-[280px] shrink-0 h-full border-r border-white/[0.06] bg-surface/95 flex flex-col">
          <div className="flex border-b border-white/[0.06]" role="tablist">
            <LeftTab active={leftTab === "brief"} onClick={() => setLeftTab("brief")}>
              <ClipboardList size={12} aria-hidden /> Brief
            </LeftTab>
            <LeftTab active={leftTab === "build"} onClick={() => setLeftTab("build")}>
              <Blocks size={12} aria-hidden /> Components
            </LeftTab>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {leftTab === "build" && <Palette embedded />}
            {leftTab === "brief" && (
              !challenge ? (
                <div className="p-4 flex flex-col gap-3">
                  {[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-elevated animate-pulse" />)}
                </div>
              ) : attempt ? (
                <AttemptResult
                  attempt={attempt}
                  onRetry={() => setAttempt(null)}
                  onShowSolution={showSolution}
                  solutionNote={solutionNote}
                  isNewBest={!!user && (priorBest == null || attempt.score > priorBest)}
                />
              ) : (
                <div className="px-4 py-4">
                  <Link to="/challenges" className="inline-flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink mb-3">
                    <ArrowLeft size={12} /> All challenges
                  </Link>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h1 className="font-display font-semibold text-[15.5px] text-ink leading-snug">{challenge.title}</h1>
                    <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0 ${DIFFICULTY_BADGE[cap(challenge.difficulty)] || ""}`}>
                      {cap(challenge.difficulty)}
                    </span>
                  </div>
                  {/* Problem / Solution — same two-card language as a case
                      study's Problem → Solution read (CaseStudyDetail.jsx):
                      what you're up against, then what a solution has to
                      satisfy. Red label vs. mint label, side by side in spirit
                      even though this rail is too narrow to run them side by
                      side literally. */}
                  <div className="rounded-lg border border-red-500/25 bg-red-500/[0.05] px-3 py-2.5 mb-3">
                    <h3 className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-red-400/90 mb-1.5">The problem</h3>
                    <p className="text-[12px] text-ink/85 leading-relaxed mb-2.5">{challenge.description}</p>
                    <p className="font-mono text-[11px] text-ink/90 tabular-nums leading-relaxed">
                      {fmt(challenge.load_rps)} rps · {challenge.workload?.read_pct ?? 80}% reads
                      {challenge.latency_budget_ms && <> · ≤{challenge.latency_budget_ms}ms</>}
                    </p>
                    <p className="text-[10.5px] text-muted mt-1">The toolbar load is pre-set — your design is scored under this traffic.</p>
                  </div>

                  <div className="rounded-lg border border-mint/25 bg-mint/[0.05] px-3 py-2.5 mb-5">
                    <h3 className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mint/90 mb-1.5">The solution</h3>
                    <p className="text-[10.5px] text-muted mb-2">A design here needs to:</p>
                    <ul className="flex flex-col gap-1.5">
                      {(challenge.requirements || []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-ink/85 leading-relaxed">
                          <Target size={11} className="text-mint/80 mt-[3px] shrink-0" aria-hidden />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Hints */}
                  {challenge.hints?.length > 0 && (
                    <div className="mb-5">
                      <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/70 mb-2">Hints</h3>
                      {challenge.hints.slice(0, hintsShown).map((h, i) => (
                        <p key={i} className="flex gap-2 text-[11.5px] text-ink/75 leading-relaxed mb-2 border-l-2 border-amber-400/40 pl-2.5">
                          {h}
                        </p>
                      ))}
                      {hintsShown < challenge.hints.length && (
                        <button
                          type="button"
                          onClick={() => setHintsShown((n) => n + 1)}
                          className="inline-flex items-center gap-1.5 text-[11.5px] text-amber-300/90 hover:text-amber-200"
                        >
                          <Lightbulb size={12} /> Reveal hint {hintsShown + 1} of {challenge.hints.length}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Solution escape hatch — always reachable, never pushed */}
                  <div className="mt-2 pt-4 border-t border-white/[0.05]">
                    {solutionNote ? (
                      <p className="text-[11.5px] text-muted leading-relaxed border-l-2 border-indigo-500/40 pl-2.5">
                        Reference architecture loaded on the canvas. {solutionNote}
                      </p>
                    ) : peekConfirm ? (
                      <div className="rounded-lg border border-white/[0.08] bg-elevated/60 p-3">
                        <p className="text-[11.5px] text-muted leading-relaxed mb-2.5">
                          This replaces your canvas with the reference architecture. You learn more by trying first — but studying a good answer beats staying stuck.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={showSolution}
                            className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink bg-white/[0.06] hover:bg-white/[0.1] rounded-md px-2.5 py-1.5"
                          >
                            <Eye size={12} /> Show it
                          </button>
                          <button
                            type="button"
                            onClick={() => setPeekConfirm(false)}
                            className="flex-1 text-[12px] text-muted hover:text-ink rounded-md px-2.5 py-1.5"
                          >
                            Keep building
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPeekConfirm(true)}
                        className="inline-flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink transition-colors"
                      >
                        <Eye size={12} /> Stuck? Study the reference solution
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Submit — always visible while briefing */}
          {challenge && !attempt && (
            <div className="p-3 border-t border-white/[0.06]">
              {submitError && <p className="text-[11px] text-red-400 mb-2">{submitError}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={submitting || nodes.length === 0}
                className="btn-primary w-full flex items-center justify-center gap-2 text-white text-[13px] font-medium rounded-lg px-4 py-2 disabled:opacity-40"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                Submit for scoring
              </button>
            </div>
          )}
        </aside>

        {/* Canvas */}
        <div className="relative flex-1 min-w-0">
          <SimBar onSave={() => setSaveModalOpen(true)} />
          {simError && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 max-w-md text-center bg-red-500/10 border border-red-500/30 text-red-300 text-[12.5px] rounded-lg px-4 py-2">
              {simError}
            </div>
          )}
          {nodes.length === 0 && (
            <div className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none">
              <p className="text-[13px] text-muted max-w-[36ch] text-center leading-relaxed">
                Build your design here — components are in the left panel. Simulate as often as you like before submitting.
              </p>
            </div>
          )}
          <CanvasArea />
        </div>

        {/* Right: inspect / results */}
        {(selectedNode || simResult) && (
          <aside className="w-[300px] shrink-0 h-full border-l border-white/[0.06] bg-surface/95 flex flex-col">
            <div className="flex border-b border-white/[0.06]" role="tablist">
              <LeftTab active={rightTab === "inspect"} onClick={() => setRightTab("inspect")} disabled={!selectedNode}>
                <MousePointerClick size={12} aria-hidden /> Inspect
              </LeftTab>
              <LeftTab active={rightTab === "results"} onClick={() => setRightTab("results")} disabled={!simResult}>
                <BarChart3 size={12} aria-hidden /> Results
              </LeftTab>
            </div>
            <div className="flex-1 min-h-0">
              {rightTab === "inspect" && selectedNode && <PropertiesPanel node={selectedNode} />}
              {rightTab === "inspect" && !selectedNode && (
                <p className="px-4 py-6 text-[12px] text-muted">Select a node to configure it.</p>
              )}
              {rightTab === "results" && <ResultsPanel />}
            </div>
          </aside>
        )}

        <LearnDrawer />
        <SaveDesignModal mode="challenge" />
      </div>
    </ReactFlowProvider>
  );
}

function AttemptResult({ attempt, onRetry, onShowSolution, solutionNote, isNewBest }) {
  const score = attempt.score ?? 0;
  const [confirmingSolution, setConfirmingSolution] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const shouldReduce = useReducedMotion();

  // Count up from 0 instead of flashing the number straight in — a small,
  // deliberate beat that makes the score feel earned rather than printed.
  const [displayScore, setDisplayScore] = useState(shouldReduce ? score : 0);
  useEffect(() => {
    if (shouldReduce) { setDisplayScore(score); return; }
    let raf;
    const duration = 700;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      setDisplayScore(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, shouldReduce]);

  const tone = score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const groups = [
    { key: "good",    title: "What works",   icon: CheckCircle2,  cls: "text-emerald-400" },
    { key: "weak",    title: "Weak spots",   icon: AlertTriangle, cls: "text-amber-400" },
    { key: "missing", title: "Missing",      icon: XCircle,       cls: "text-red-400" },
  ];

  const revealSolution = async () => {
    setLoadingSolution(true);
    try {
      await onShowSolution();
    } finally {
      setLoadingSolution(false);
      setConfirmingSolution(false);
    }
  };
  return (
    <div className="px-4 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70 mb-1">Score</p>
      <p className={`font-display text-[3rem] font-bold leading-none tabular-nums ${tone}`}>
        {displayScore}<span className="text-[15px] text-muted font-sans font-normal">/100</span>
      </p>
      {isNewBest && (
        <span className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2.5 py-1">
          <Trophy size={11} aria-hidden /> New best!
        </span>
      )}

      <div className="flex flex-col gap-4 mt-5">
        {groups.map(({ key, title, icon: Icon, cls }) => {
          const items = attempt.feedback?.[key] || [];
          if (items.length === 0) return null;
          return (
            <section key={key}>
              <h3 className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] mb-1.5 ${cls}`}>
                <Icon size={12} aria-hidden /> {title}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {items.map((f, i) => (
                  <li key={i} className="text-[12px] text-ink/80 leading-relaxed border-l-2 border-white/[0.08] pl-2.5">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 w-full flex items-center justify-center gap-2 border border-indigo-500/30 bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] text-indigo-300 text-[12.5px] font-medium rounded-lg px-3 py-2"
      >
        <RotateCcw size={13} /> Keep iterating
      </button>

      {/* Reference solution — earned by attempting first */}
      {solutionNote ? (
        <p className="mt-4 text-[11.5px] text-muted leading-relaxed border-l-2 border-indigo-500/40 pl-2.5">
          Reference architecture loaded on the canvas. {solutionNote}
        </p>
      ) : confirmingSolution ? (
        <div className="mt-4 rounded-lg border border-white/[0.08] bg-elevated/60 p-3">
          <p className="text-[11.5px] text-muted leading-relaxed mb-2.5">
            This replaces your canvas with the reference architecture. Your score is already saved.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={revealSolution}
              disabled={loadingSolution}
              className="flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium text-ink bg-white/[0.06] hover:bg-white/[0.1] rounded-md px-2.5 py-1.5 disabled:opacity-50"
            >
              {loadingSolution ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
              Show it
            </button>
            <button
              type="button"
              onClick={() => setConfirmingSolution(false)}
              className="flex-1 text-[12px] text-muted hover:text-ink rounded-md px-2.5 py-1.5"
            >
              Keep my design
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingSolution(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 text-[12px] text-muted hover:text-ink py-1.5 transition-colors"
        >
          <Eye size={12} /> Compare with the reference solution
        </button>
      )}
    </div>
  );
}

function LeftTab({ active, disabled, onClick, children }) {
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
