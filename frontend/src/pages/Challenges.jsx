// Challenges as a learning track: a vertical rail with numbered, difficulty-
// colored step markers (metro-map style), grouped into Beginner →
// Intermediate → Advanced zones. Deliberately NOT a stack of boxes — rhythm
// comes from the spine, zone headers, and alternating row weight.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, RefreshCw, CheckCircle2 } from "lucide-react";
import { api } from "@/api/client";
import { useStore } from "@/store";
import { DIFFICULTIES } from "@/data/constants";
import PageGlow from "@/components/ui/PageGlow";

const SOLVED_THRESHOLD = 70;

const EST_TIME = { Beginner: "~25 min", Intermediate: "~40 min", Advanced: "~55 min" };

// One visual identity per difficulty zone. Never color alone: each zone also
// carries its name and a numbered level label.
const ZONE = {
  Beginner: {
    level: "Level 01",
    blurb: "Foundations — one clear bottleneck per scenario.",
    dot: "bg-emerald-400",
    marker: "border-emerald-500/50 text-emerald-300 group-hover:border-emerald-400",
    label: "text-emerald-400",
    line: "bg-emerald-500/15",
  },
  Intermediate: {
    level: "Level 02",
    blurb: "Compound problems — caches, queues, and read/write splits.",
    dot: "bg-amber-400",
    marker: "border-amber-500/50 text-amber-300 group-hover:border-amber-400",
    label: "text-amber-400",
    line: "bg-amber-500/15",
  },
  Advanced: {
    level: "Level 03",
    blurb: "Production-grade scale — sharding, isolation, worst-minute design.",
    dot: "bg-red-400",
    marker: "border-red-500/50 text-red-300 group-hover:border-red-400",
    label: "text-red-400",
    line: "bg-red-500/15",
  },
};

const ZONE_ORDER = ["Beginner", "Intermediate", "Advanced"];

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function TrackItem({ c, step, zone, emphasized, bestScore }) {
  const solved = bestScore != null && bestScore >= SOLVED_THRESHOLD;
  const attempted = bestScore != null;
  return (
    <Link
      to={`/challenges/${c.slug}`}
      className="group relative block pl-14 pr-4 py-5 rounded-xl hover:bg-elevated/35 transition-colors duration-150"
    >
      {/* Step marker on the rail — swaps to a checkmark once solved */}
      <span
        className={`absolute left-2.5 top-5 w-8 h-8 rounded-full bg-base border-2 flex items-center justify-center
                    font-mono text-[11px] transition-colors duration-150 ${
                      solved ? "border-emerald-500/60 text-emerald-400" : zone.marker
                    }`}
        aria-hidden
      >
        {solved ? <CheckCircle2 size={15} /> : String(step).padStart(2, "0")}
      </span>

      <div className="flex items-start justify-between gap-4">
        <h3
          className={`font-display font-semibold text-ink leading-snug group-hover:text-white transition-colors duration-150 ${
            emphasized ? "text-[1.2rem]" : "text-[1.02rem]"
          }`}
        >
          {c.title}
        </h3>
        <span className="flex items-center gap-3 shrink-0 mt-0.5">
          {attempted && (
            <span
              className={`font-mono text-[11px] tabular-nums ${
                solved ? "text-emerald-400" : bestScore >= 50 ? "text-amber-400" : "text-red-400"
              }`}
              title={`Best score: ${bestScore}/100`}
            >
              {bestScore}<span className="text-muted/50">/100</span>
            </span>
          )}
          <span className="text-sm text-muted/40 group-hover:text-indigo-400 transition-colors duration-150 flex items-center gap-1.5 font-medium">
            {solved ? "Retry" : attempted ? "Continue" : "Start"}
            <ArrowRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </span>
      </div>

      <p className={`text-muted text-[0.85rem] leading-relaxed mt-1.5 max-w-[58ch] ${emphasized ? "" : "line-clamp-2"}`}>
        {c.description}
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted/50">
          <Clock size={10} aria-hidden />
          {EST_TIME[c.difficulty] || "~30 min"}
        </span>
        {(c.tags || []).length > 0 && <span className="text-muted/20 font-mono text-xs" aria-hidden>·</span>}
        {(c.tags || []).map((tag) => (
          <span
            key={tag}
            className="font-mono text-[10px] text-muted/60 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

export default function Challenges() {
  const [active, setActive] = useState("All");
  const [challenges, setChallenges] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const user = useStore((s) => s.user);
  const [attempts, setAttempts] = useState(null); // best score per slug, once loaded

  const load = () => {
    setError(null);
    setChallenges(null);
    api.listChallenges()
      .then((data) => setChallenges(data.challenges || data))
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  // Progress: best score per challenge, so the track shows what's already solved.
  useEffect(() => {
    if (!user) { setAttempts(null); return; }
    api.myAttempts()
      .then((data) => setAttempts(data.attempts || data))
      .catch(() => setAttempts([]));
  }, [user]);

  const bestBySlug = new Map();
  (attempts || []).forEach((a) => {
    const prev = bestBySlug.get(a.challenge_slug) ?? -1;
    if ((a.score ?? 0) > prev) bestBySlug.set(a.challenge_slug, a.score ?? 0);
  });
  const solvedCount = [...bestBySlug.values()].filter((s) => s >= SOLVED_THRESHOLD).length;

  const items = (challenges || []).map((c) => ({ ...c, difficulty: cap(c.difficulty) }));
  const filtered = active === "All" ? items : items.filter((c) => c.difficulty === active);

  // Zones in track order; step numbers run globally so the page reads as one path.
  const stepOf = new Map();
  let step = 0;
  ZONE_ORDER.forEach((d) => {
    items.filter((c) => c.difficulty === d).forEach((c) => stepOf.set(c.slug, ++step));
  });

  const visibleZones = ZONE_ORDER
    .filter((d) => active === "All" || active === d)
    .map((d) => ({ name: d, list: filtered.filter((c) => c.difficulty === d) }))
    .filter((z) => z.list.length > 0);

  return (
    <div className="relative bg-base min-h-screen">
      <PageGlow blobs={[
        { x: "18%", y: "0%",  w: "55%", h: "65%", color: "rgba(124, 92, 255,0.16)" },
        { x: "88%", y: "6%",  w: "40%", h: "50%", color: "rgba(251,191,36,0.08)" },
      ]} />
      <div className="relative z-10 max-w-4xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-white/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            Practice Arena
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl mb-3 bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent">
                Challenges
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                A track of design scenarios, easiest first. Build the architecture on the canvas, run the scenario's real traffic through it, and get scored with specific feedback.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              {user ? (
                <>
                  <div className="text-right">
                    <p className="font-display text-3xl text-emerald-400 font-bold leading-none mb-1.5">
                      {solvedCount}<span className="text-muted text-lg">/{items.length || 0}</span>
                    </p>
                    <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Solved</p>
                  </div>
                  <div className="w-px h-9 bg-white/[0.06]" />
                </>
              ) : null}
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">{items.length || "—"}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Stops on the track</p>
              </div>
              <div className="w-px h-9 bg-white/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-amber-400 font-bold leading-none mb-1.5">{DIFFICULTIES.length - 1}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Levels</p>
              </div>
            </div>
          </div>
          {!user && (
            <p className="mt-5 text-[12.5px] text-muted/70">
              <Link to="/login" className="text-indigo-300 hover:text-indigo-200 font-medium">Sign in</Link>
              {" "}to track which challenges you've solved.
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap py-4 border-b border-white/[0.05]">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActive(d)}
              className={`text-sm px-4 py-1.5 rounded-full transition-all duration-150 ${
                active === d
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-muted/70 hover:text-ink hover:bg-white/[0.04]"
              }`}
            >
              {d}
            </button>
          ))}
          <span className="ml-auto font-mono text-xs text-muted/40">
            {filtered.length} challenge{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Track */}
        <div className="pt-8 pb-24">
          {challenges === null && !error && (
            <div className="flex flex-col gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="w-8 h-8 rounded-full bg-surface border border-white/[0.05] animate-pulse shrink-0" />
                  <div className="flex-1 h-[104px] rounded-xl bg-surface border border-white/[0.05] animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="py-20 text-center">
              <p className="text-muted text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 text-sm text-indigo-300 border border-indigo-500/30 rounded-lg px-4 py-2 hover:bg-indigo-500/10"
              >
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {visibleZones.map((z, zi) => {
            const zone = ZONE[z.name];
            return (
              <section key={z.name} className={zi > 0 ? "mt-10" : ""}>
                {/* Zone header */}
                <div className="flex items-baseline gap-3 mb-2 pl-1">
                  <span className={`w-2 h-2 rounded-full self-center shrink-0 ${zone.dot}`} aria-hidden />
                  <h2 className={`font-mono text-[11px] uppercase tracking-[0.14em] ${zone.label}`}>
                    {zone.level} · {z.name}
                  </h2>
                  <span className="text-[12px] text-muted/60 hidden sm:inline">{zone.blurb}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted/40">
                    {z.list.length} scenario{z.list.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Rail + items */}
                <div className="relative">
                  <span
                    className={`absolute left-[25.5px] top-6 bottom-6 w-px ${zone.line}`}
                    aria-hidden
                  />
                  <div className="flex flex-col">
                    {z.list.map((c, i) => (
                      <TrackItem
                        key={c.slug}
                        c={c}
                        step={stepOf.get(c.slug)}
                        zone={zone}
                        emphasized={i === 0}
                        bestScore={bestBySlug.has(c.slug) ? bestBySlug.get(c.slug) : null}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })}

          {challenges !== null && !error && filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-mono text-sm text-muted/50">No challenges at this difficulty yet.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
