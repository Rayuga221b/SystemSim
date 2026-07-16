// Interview prep: the 45-minute interview demystified as an interactive
// phase timeline, the grading signals per level, the classic failure modes,
// and — the part only SystemSim can do — drills that map each interview
// skill onto the sandbox, challenges, and case studies.
//
// All content lives in data/interview.js; this file only renders it.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, Check, CheckCircle2, ClipboardCheck,
  Dumbbell, ListChecks, Quote, ShieldAlert, Target,
} from "lucide-react";
import {
  INTERVIEW_MINUTES, PHASES, SIGNALS, MISTAKES, DRILLS, PLAN,
} from "@/data/interview";

const PLAN_KEY = "systemsim_interview_plan";

function loadPlanState() {
  try {
    return new Set(JSON.parse(localStorage.getItem(PLAN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

// One accent per section — replaces the uniform indigo-everywhere chrome with
// a distinct color per topic, so the page reads as six places, not one long list.
const ACCENT = {
  timeline: "#9B85FF",  // indigo — the phase-by-phase walkthrough
  signals:  "#38BDF8",  // sky — what's being graded
  mistakes: "#FBBF24",  // amber — failure modes (kept warning-colored)
  drills:   "#A78BFA",  // violet — practice exercises
  plan:     "#34D399",  // emerald — the two-week plan
};

// Soft, blurred color bloom anchored to a section — purely decorative.
function Glow({ color, className = "-top-16 right-0 w-[420px] h-[420px]" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl opacity-[0.10] ${className}`}
      style={{ background: color }}
    />
  );
}

/* ---------------------------------------------------------- phase timeline */

function PhaseTimeline() {
  const [activeId, setActiveId] = useState(PHASES[0].id);
  const active = PHASES.find((p) => p.id === activeId);

  return (
    <div>
      {/* The bar: one segment per phase, width proportional to minutes */}
      <div className="flex items-center justify-between mb-2 font-mono text-[10px] text-muted/50 uppercase tracking-wider">
        <span>min 0</span>
        <span>min {INTERVIEW_MINUTES}</span>
      </div>
      <div className="flex gap-1" role="tablist" aria-label="Interview phases">
        {PHASES.map((p) => {
          const isActive = p.id === activeId;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="phase-detail"
              onClick={() => setActiveId(p.id)}
              style={{ width: `${(p.minutes / INTERVIEW_MINUTES) * 100}%` }}
              className="group min-w-0 focus:outline-none"
              title={`${p.label} — ${p.minutes} min`}
            >
              <span
                className="block h-9 rounded transition-all duration-150"
                style={{
                  backgroundColor: isActive ? p.color : `${p.color}38`,
                  boxShadow: isActive ? `0 0 0 1px ${p.color}` : "none",
                }}
              />
              <span className="mt-2 hidden sm:flex flex-col items-start min-w-0">
                <span
                  className={`text-[11px] font-medium truncate max-w-full transition-colors ${
                    isActive ? "text-ink" : "text-muted group-hover:text-ink/80"
                  }`}
                >
                  {p.label}
                </span>
                <span className="font-mono text-[10px] text-muted/50">{p.minutes} min</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail card for the selected phase */}
      <div
        id="phase-detail"
        role="tabpanel"
        className="mt-5 sm:mt-4 bg-surface border border-hairline/[0.07] rounded-xl p-5 sm:p-6"
        style={{ borderTopColor: `${active.color}66`, borderTopWidth: 2 }}
      >
        <div className="flex items-baseline gap-3 flex-wrap mb-2">
          <h3 className="font-display font-semibold text-ink text-[1.05rem]">{active.label}</h3>
          <span className="font-mono text-[11px]" style={{ color: active.color }}>
            ~{active.minutes} minutes
          </span>
        </div>
        <p className="text-[0.875rem] text-ink/80 leading-relaxed mb-4 max-w-[62ch]">{active.goal}</p>

        <ul className="flex flex-col gap-2 mb-4">
          {active.do.map((d, i) => (
            <li key={i} className="flex gap-2.5 text-[0.845rem] text-muted leading-relaxed max-w-[68ch]">
              <Check size={13} className="shrink-0 mt-[3px]" style={{ color: active.color }} aria-hidden />
              <span>{d}</span>
            </li>
          ))}
        </ul>

        <blockquote
          className="border-l-2 pl-3.5 py-0.5 mb-4 text-[0.845rem] text-ink/85 italic leading-relaxed max-w-[62ch]"
          style={{ borderColor: active.color }}
        >
          <Quote size={11} className="inline mr-1.5 -mt-0.5 opacity-60" aria-hidden />
          {active.say}
        </blockquote>

        <p className="flex gap-2.5 text-[0.8125rem] text-amber-400/90 leading-relaxed max-w-[68ch]">
          <AlertTriangle size={13} className="shrink-0 mt-[3px]" aria-hidden />
          <span>
            <span className="font-medium">Red flag:</span>{" "}
            <span className="text-amber-400/75">{active.redFlag}</span>
          </span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function InterviewPrep() {
  const [done, setDone] = useState(loadPlanState);

  useEffect(() => {
    localStorage.setItem(PLAN_KEY, JSON.stringify([...done]));
  }, [done]);

  const toggle = (id) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalItems = PLAN.reduce((n, w) => n + w.items.length, 0);

  return (
    <div className="relative isolate overflow-hidden bg-base min-h-screen">
      {/* Ambient backdrop: indigo bloom behind the hero, faint dot texture
          across the whole page so it doesn't read as a flat list of sections. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] z-0"
        style={{
          background: [
            "radial-gradient(ellipse 60% 70% at 22% 0%, rgba(124, 92, 255,0.16) 0%, transparent 60%)",
            "radial-gradient(ellipse 45% 55% at 85% 8%, rgba(244,114,182,0.10) 0%, transparent 65%)",
          ].join(", "),
        }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[420px] dot-grid opacity-[0.14] z-0" />

      <div className="relative z-10 max-w-4xl mx-auto px-6">

        {/* ------------------------------------------------------- header */}
        <div className="py-16 sm:py-20 border-b border-hairline/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            Interview Prep
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1
                className="font-display font-semibold text-4xl sm:text-5xl mb-3 bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent"
                style={{ textWrap: "balance" }}
              >
                The interview, demystified
              </h1>
              <p className="text-ink/70 text-[0.9375rem] max-w-[52ch] leading-relaxed">
                A system design interview is 45 minutes with a known shape and a known rubric.
                Here's the shape, the rubric, and — since you're already inside a simulator —
                the exact drills to practice each part.
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">45<span className="text-muted text-lg"> min</span></p>
                <p className="font-mono text-[10px] text-muted/60 uppercase tracking-wider">One interview</p>
              </div>
              <div className="text-right rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3">
                <p className="font-display text-3xl text-indigo-400 font-bold leading-none mb-1.5">{PHASES.length}</p>
                <p className="font-mono text-[10px] text-muted/60 uppercase tracking-wider">Phases</p>
              </div>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------- timeline */}
        <section className="relative pt-10 pb-14 border-b border-hairline/[0.05]">
          <Glow color={ACCENT.timeline} className="-top-20 right-0 w-[380px] h-[380px]" />
          <h2 className="relative flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink mb-1">
            <Target size={15} style={{ color: ACCENT.timeline }} aria-hidden /> The 45 minutes, mapped
          </h2>
          <p className="relative text-muted text-[0.875rem] mb-6 max-w-[58ch]">
            Nearly every loop — Meta, Google, Amazon, startups — runs some version of this
            timeline. Click a phase to see what to do, what to say, and the red flag to avoid.
          </p>
          <PhaseTimeline />
        </section>

        {/* ------------------------------------------------------ signals */}
        <section className="relative pt-12 pb-14 border-b border-hairline/[0.05]">
          <Glow color={ACCENT.signals} className="-top-16 right-0 w-[420px] h-[420px]" />
          <h2 className="relative flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink mb-1">
            <ClipboardCheck size={15} style={{ color: ACCENT.signals }} aria-hidden /> What they're actually grading
          </h2>
          <p className="relative text-muted text-[0.875rem] mb-6 max-w-[58ch]">
            Not the diagram — the reasoning. Four signals show up on almost every rubric,
            and the same answer lands differently depending on the level you're interviewing for.
          </p>

          <div className="relative grid sm:grid-cols-2 gap-3">
            {SIGNALS.map((s) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.id}
                  className="bg-surface border border-hairline/[0.07] rounded-xl p-5 hover:border-sky-500/30 transition-colors duration-150"
                >
                  <h3 className="flex items-center gap-2 font-display font-semibold text-ink text-[0.9375rem] mb-2">
                    <Icon size={15} style={{ color: ACCENT.signals }} aria-hidden /> {s.title}
                  </h3>
                  <p className="text-[0.8125rem] text-muted leading-relaxed mb-4">{s.blurb}</p>
                  <dl className="flex flex-col gap-2 border-t border-hairline/[0.05] pt-3.5">
                    {[
                      ["mid", "MID"],
                      ["senior", "SR"],
                      ["staff", "STF"],
                    ].map(([key, tag]) => (
                      <div key={key} className="flex gap-2.5 items-start">
                        <dt className="font-mono text-[9.5px] tracking-wider text-indigo-300/70 bg-indigo-500/[0.08] border border-indigo-500/20 rounded px-1.5 py-0.5 w-9 text-center shrink-0 mt-[1px]">
                          {tag}
                        </dt>
                        <dd className="text-[0.78rem] text-ink/70 leading-relaxed">{s.levels[key]}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        {/* ----------------------------------------------------- mistakes */}
        <section className="relative pt-12 pb-14 border-b border-hairline/[0.05]">
          <Glow color={ACCENT.mistakes} className="-top-16 right-0 w-[400px] h-[400px]" />
          <h2 className="relative flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink mb-1">
            <ShieldAlert size={15} className="text-amber-400" aria-hidden /> The seven deadly mistakes
          </h2>
          <p className="relative text-muted text-[0.875rem] mb-6 max-w-[58ch]">
            Interviewers see the same failure modes every week. Each one has a boring,
            reliable fix.
          </p>

          <div className="relative flex flex-col">
            {MISTAKES.map((m, i) => (
              <div key={m.id} className="group flex gap-4 border-b border-hairline/[0.05] last:border-b-0 py-5 pl-3 -ml-3 rounded-lg hover:bg-amber-500/[0.03] transition-colors duration-150">
                <span className="font-mono text-[11px] text-amber-400/70 mt-1 shrink-0 w-6">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink text-[0.9375rem] mb-1.5">{m.title}</h3>
                  <p className="text-[0.845rem] text-muted leading-relaxed max-w-[64ch] mb-2">{m.detail}</p>
                  <p className="text-[0.845rem] leading-relaxed max-w-[64ch]">
                    <span className="font-mono text-[10.5px] text-emerald-400/90 uppercase tracking-wider mr-2">Fix</span>
                    <span className="text-ink/80">{m.fix}</span>
                    {m.link && (
                      <>
                        {" "}
                        <Link to={m.link} className="text-indigo-300 hover:text-indigo-200 whitespace-nowrap">
                          {m.linkLabel} →
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- drills */}
        <section className="relative pt-12 pb-14 border-b border-hairline/[0.05]">
          <Glow color={ACCENT.drills} className="-top-16 right-0 w-[420px] h-[420px]" />
          <h2 className="relative flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink mb-1">
            <Dumbbell size={15} style={{ color: ACCENT.drills }} aria-hidden /> Practice with intent
          </h2>
          <p className="relative text-muted text-[0.875rem] mb-6 max-w-[58ch]">
            Reading guides doesn't build interview reflexes — reps do. Each interview skill
            below maps to a concrete exercise inside SystemSim.
          </p>

          <div className="relative grid sm:grid-cols-2 gap-3">
            {DRILLS.map((d) => {
              const Icon = d.icon;
              return (
                <article
                  key={d.id}
                  className="group bg-surface border border-hairline/[0.07] rounded-xl p-5 flex flex-col hover:border-violet-500/30 transition-colors duration-150"
                >
                  <h3 className="flex items-center gap-2 font-display font-semibold text-ink text-[0.9375rem] mb-2">
                    <span className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Icon size={15} style={{ color: ACCENT.drills }} aria-hidden />
                    </span>
                    {d.skill}
                  </h3>
                  <p className="text-[0.8125rem] text-muted leading-relaxed mb-4 flex-1">{d.exercise}</p>
                  <Link
                    to={d.to}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-violet-300 hover:text-violet-200"
                  >
                    {d.linkLabel} <ArrowRight size={13} aria-hidden />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------- prep plan */}
        <section className="relative pt-12 pb-14 border-b border-hairline/[0.05]">
          <Glow color={ACCENT.plan} className="-top-16 right-0 w-[400px] h-[400px]" />
          <div className="relative flex items-end justify-between gap-4 mb-1">
            <h2 className="flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink">
              <ListChecks size={15} style={{ color: ACCENT.plan }} aria-hidden /> The two-week plan
            </h2>
            <p className="font-mono text-[11px] text-muted/60 shrink-0">
              <span className={done.size === totalItems ? "text-emerald-400" : "text-indigo-300"}>{done.size}</span>
              /{totalItems} done
            </p>
          </div>
          <p className="relative text-muted text-[0.875rem] mb-6 max-w-[58ch]">
            Interview in two weeks? This is the order. Interview in one week? Do week 2 and
            skim week 1. Checkmarks persist on this device.
          </p>

          <div className="relative grid sm:grid-cols-2 gap-3 items-start">
            {PLAN.map((week) => (
              <div key={week.id} className="bg-surface border border-hairline/[0.07] rounded-xl p-5 hover:border-emerald-500/25 transition-colors duration-150">
                <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-emerald-300/80 mb-4">
                  {week.label}
                </h3>
                <ul className="flex flex-col gap-3">
                  {week.items.map((item) => {
                    const checked = done.has(item.id);
                    return (
                      <li key={item.id} className="flex items-start gap-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          aria-label={item.text}
                          onClick={() => toggle(item.id)}
                          className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded flex items-center justify-center border transition-colors ${
                            checked
                              ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400"
                              : "border-hairline/[0.15] text-transparent hover:border-emerald-400/60"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
                        <span className={`text-[0.8125rem] leading-relaxed transition-colors ${checked ? "text-muted/50 line-through" : "text-ink/80"}`}>
                          {item.text}
                          {item.to && (
                            <>
                              {" "}
                              <Link to={item.to} className="text-indigo-300 hover:text-indigo-200 no-underline whitespace-nowrap">
                                {item.linkLabel} →
                              </Link>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA */}
        <section className="relative mt-6 mb-24 rounded-xl border border-indigo-500/25 overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                "radial-gradient(ellipse 70% 100% at 15% 0%, rgba(124, 92, 255,0.14) 0%, transparent 65%)",
                "radial-gradient(ellipse 50% 80% at 100% 100%, rgba(244,114,182,0.08) 0%, transparent 60%)",
                "rgba(124, 92, 255,0.04)",
              ].join(", "),
            }}
          />
          <h2 className="relative flex items-center gap-2 font-display font-semibold text-[1.275rem] text-ink mb-2">
            <CheckCircle2 size={16} className="text-indigo-400" aria-hidden /> The interview rewards reps, not reading
          </h2>
          <p className="relative text-[0.875rem] text-muted leading-relaxed mb-5 max-w-[58ch]">
            You now know the shape of the hour. The candidates who pass are the ones who've
            already lived it a few times — timer on, out loud, with a system breaking in front
            of them.
          </p>
          <div className="relative flex flex-wrap gap-3">
            <Link to="/challenges" className="btn-primary inline-flex items-center gap-2 text-white text-[13.5px] font-medium rounded-lg px-5 py-2.5">
              Run your first mock <ArrowRight size={14} aria-hidden />
            </Link>
            <Link
              to="/sandbox"
              className="inline-flex items-center gap-2 text-[13.5px] font-medium text-ink border border-hairline/[0.1] rounded-lg px-5 py-2.5 hover:bg-elevated hover:border-indigo-500/35 transition-colors"
            >
              Warm up in the sandbox
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
