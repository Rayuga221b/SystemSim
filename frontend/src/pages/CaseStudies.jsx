// Case studies set like an engineering magazine: a lead story with big display
// type and a brand-color rule, a second feature beside it, then a compact
// ranked index — rows, not boxes. Deliberately a different shape from the
// Challenges track.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { DIFFICULTIES, DIFFICULTY_BADGE } from "@/data/constants";
import BrandIcon from "@/components/ui/BrandIcon";
import PageGlow from "@/components/ui/PageGlow";

// Brand accent colors for card accents
export const BRAND_COLOR = {
  "Discord":            "#5865F2",
  "Twitter / X":        "#60A5FA",
  "Twitter":            "#60A5FA",
  "Netflix":            "#E50914",
  "Slack":              "#ECB22E",
  "Uber":               "#9CA3AF",
  "Amazon":             "#FF9900",
  "Amazon Prime Video": "#00A8E1",
  "Instagram":          "#E1306C",
  "Shopify":            "#96BF48",
};

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ─── Lead story (№ 01) — big editorial typography ────────────────────────────

function LeadStory({ cs }) {
  const color = BRAND_COLOR[cs.company] ?? "#7C5CFF";
  return (
    <Link
      to={`/case-studies/${cs.slug}`}
      className="group relative block border-l-2 pl-6 sm:pl-8 py-2 transition-colors duration-150"
      style={{ borderColor: color }}
    >
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="font-mono text-[11px] text-muted/50 tracking-[0.12em]">№ 01 — LEAD STORY</span>
        <span className="flex items-center gap-2">
          <BrandIcon company={cs.company} size={16} />
          <span className="font-mono text-[11px] tracking-wide" style={{ color }}>{cs.company}</span>
        </span>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[cs.difficulty]}`}>
          {cs.difficulty}
        </span>
      </div>

      <h2
        className="font-display font-semibold text-ink text-[1.75rem] sm:text-[2.5rem] leading-[1.12] tracking-[-0.02em] mb-4 group-hover:text-white transition-colors duration-150"
        style={{ textWrap: "balance" }}
      >
        {cs.title}
      </h2>

      <p className="text-muted text-[1rem] leading-relaxed max-w-[54ch] mb-5">
        {cs.one_liner}
      </p>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1.5 transition-colors duration-150">
          Read the study
          <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </span>
        <span className="flex gap-1.5 flex-wrap">
          {(cs.tags || []).map((tag) => (
            <span key={tag} className="font-mono text-[10px] text-muted/50 bg-hairline/[0.03] border border-hairline/[0.05] px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </span>
      </div>
    </Link>
  );
}

// ─── Second feature (№ 02) — smaller, still display-set ─────────────────────

function SecondFeature({ cs }) {
  const color = BRAND_COLOR[cs.company] ?? "#7C5CFF";
  return (
    <Link
      to={`/case-studies/${cs.slug}`}
      className="group relative block bg-surface border border-hairline/[0.06] rounded-xl p-6 h-full transition-colors duration-200 hover:bg-elevated hover:border-hairline/[0.12]"
    >
      <span className="absolute top-0 left-6 right-6 h-px" style={{ background: color }} aria-hidden />
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <span className="font-mono text-[11px] text-muted/50 tracking-[0.12em]">№ 02</span>
        <BrandIcon company={cs.company} size={15} />
        <span className="font-mono text-[11px] tracking-wide" style={{ color }}>{cs.company}</span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_BADGE[cs.difficulty]}`}>
          {cs.difficulty}
        </span>
      </div>
      <h3 className="font-display font-semibold text-ink text-[1.3rem] leading-[1.2] tracking-[-0.01em] mb-3 group-hover:text-white transition-colors duration-150">
        {cs.title}
      </h3>
      <p className="text-muted text-[0.875rem] leading-relaxed mb-4 line-clamp-3">
        {cs.one_liner}
      </p>
      <span className="text-sm font-medium text-muted/60 group-hover:text-indigo-400 flex items-center gap-1.5 transition-colors duration-150">
        Read <ArrowRight size={12} className="transition-transform duration-150 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

// ─── Index row (№ 03+) — a line in the table of contents, not a box ─────────

function IndexRow({ cs, rank }) {
  const color = BRAND_COLOR[cs.company] ?? "#7C5CFF";
  return (
    <Link
      to={`/case-studies/${cs.slug}`}
      className="group grid grid-cols-[2.5rem_auto_1fr_auto] items-baseline gap-x-3 py-5 px-2 -mx-2 rounded-lg
                 border-b border-hairline/[0.05] hover:bg-elevated/35 transition-colors duration-150"
    >
      <span className="font-mono text-[13px] text-muted/35 group-hover:text-muted/70 transition-colors" aria-hidden>
        {String(rank).padStart(2, "0")}
      </span>
      <span className="flex items-center gap-2 self-center">
        <BrandIcon company={cs.company} size={15} className="opacity-70 group-hover:opacity-100 transition-opacity" />
        <span className="font-mono text-[11px] tracking-wide hidden sm:inline" style={{ color }}>
          {cs.company}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block font-display font-semibold text-ink text-[1.02rem] leading-snug group-hover:text-white transition-colors duration-150">
          {cs.title}
        </span>
        <span className="block text-muted/75 text-[0.8125rem] leading-relaxed mt-1 line-clamp-1">
          {cs.one_liner}
        </span>
        <span className="flex gap-1.5 flex-wrap mt-2">
          {(cs.tags || []).map((tag) => (
            <span key={tag} className="font-mono text-[10px] text-muted/45 bg-hairline/[0.03] border border-hairline/[0.05] px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </span>
      </span>
      <span className="flex items-center gap-3 self-center">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full hidden sm:inline ${DIFFICULTY_BADGE[cs.difficulty]}`}>
          {cs.difficulty}
        </span>
        <ArrowRight size={13} className="text-muted/30 group-hover:text-indigo-400 transition-all duration-150 group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CaseStudies() {
  const [active, setActive] = useState("All");
  const [studies, setStudies] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    setStudies(null);
    api.listCaseStudies()
      .then((data) => setStudies(data.case_studies || data))
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const items = (studies || []).map((cs) => ({ ...cs, difficulty: cap(cs.difficulty) }));
  const filtered = active === "All" ? items : items.filter((cs) => cs.difficulty === active);

  // Editorial hierarchy comes from position in the (filtered) list:
  // first = lead story, second = feature, the rest = the index.
  const [lead, second, ...rest] = filtered;

  return (
    <div className="relative bg-base min-h-screen">
      <PageGlow blobs={[
        { x: "18%", y: "0%",  w: "55%", h: "65%", color: "rgba(124, 92, 255,0.16)" },
        { x: "88%", y: "8%",  w: "42%", h: "52%", color: "rgba(56,189,248,0.09)" },
      ]} />
      <div className="relative z-10 max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="py-16 sm:py-20 border-b border-hairline/[0.05]">
          <p className="font-mono text-xs text-indigo-400 tracking-[0.14em] uppercase mb-4">
            Engineering Incidents
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="font-display font-semibold text-4xl sm:text-5xl mb-3 bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent">
                Case Studies
              </h1>
              <p className="text-muted text-[0.9375rem] max-w-[52ch] leading-relaxed">
                Real production incidents from top engineering teams. Each study walks you through the problem, the solution, and a canvas you can simulate yourself.
              </p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="text-right">
                <p className="font-display text-3xl text-ink font-bold leading-none mb-1.5">{items.length || "—"}</p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Studies</p>
              </div>
              <div className="w-px h-9 bg-hairline/[0.06]" />
              <div className="text-right">
                <p className="font-display text-3xl text-indigo-400 font-bold leading-none mb-1.5">
                  {items.length ? new Set(items.map((cs) => cs.company)).size : "—"}
                </p>
                <p className="font-mono text-[10px] text-muted/50 uppercase tracking-wider">Companies</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        {studies !== null && !error && (
          <div className="flex items-center gap-1.5 flex-wrap py-4 border-b border-hairline/[0.05]">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setActive(d)}
                className={`text-sm px-4 py-1.5 rounded-full transition-all duration-150 ${
                  active === d
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-muted/70 hover:text-ink hover:bg-hairline/[0.04]"
                }`}
              >
                {d}
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-muted/40">
              {filtered.length} case {filtered.length !== 1 ? "studies" : "study"}
            </span>
          </div>
        )}

        {studies === null && !error && (
          <div className="pt-12 pb-24 flex flex-col gap-8">
            <div className="h-[240px] rounded-xl bg-surface border border-hairline/[0.05] animate-pulse" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[76px] rounded-lg bg-surface border border-hairline/[0.05] animate-pulse" />
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

        {/* Front page: lead story + second feature */}
        {lead && (
          <div className="pt-12 pb-12 grid gap-10 lg:grid-cols-12 lg:gap-8 items-start">
            <div className={second ? "lg:col-span-7" : "lg:col-span-12"}>
              <LeadStory cs={lead} />
            </div>
            {second && (
              <div className="lg:col-span-5">
                <SecondFeature cs={second} />
              </div>
            )}
          </div>
        )}

        {/* The index */}
        {rest.length > 0 && (
          <div className="pb-24">
            <p className="font-mono text-[11px] text-muted/40 uppercase tracking-[0.12em] pb-2 border-b border-hairline/[0.08]">
              The Index
            </p>
            {rest.map((cs, i) => (
              <IndexRow key={cs.slug} cs={cs} rank={i + 3} />
            ))}
          </div>
        )}
        {rest.length === 0 && lead && <div className="pb-16" />}

        {studies !== null && !error && filtered.length === 0 && (
          <div className="py-20 text-center pb-24">
            <p className="font-mono text-sm text-muted/50">No case studies at this difficulty yet.</p>
          </div>
        )}

      </div>
    </div>
  );
}
