// Case study reading experience: Problem → Solution → Lessons, a scale-context
// stat strip, the components involved, "Simulate This" (loads the incident's
// BEFORE state into the sandbox), and a scoped AI mentor.
// Reading aids: a sticky mini-TOC on xl screens, numbered sections, tinted
// key-term emphasis, and a "★ Remember" callout — anchors for the eye.
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Play, Sparkles, Loader2, GraduationCap, Send,
} from "lucide-react";
import { api } from "@/api/client";
import { DIFFICULTY_BADGE } from "@/data/constants";
import { COMPONENT_BY_TYPE, CATEGORY_COLOR } from "@/lib/components";
import BrandIcon from "@/components/ui/BrandIcon";
import Prose from "@/components/ui/Prose";
import { BRAND_COLOR } from "./CaseStudies";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// Key terms (**bold** in the source prose) render tinted, not just heavier —
// gives the eye something to land on inside long paragraphs.
const PROSE_TINT = "[&_strong]:text-indigo-200 [&_strong]:font-medium max-w-[62ch]";

const TOC = [
  { id: "problem",  n: "01", label: "The Problem" },
  { id: "solution", n: "02", label: "The Solution" },
  { id: "simulate", n: "03", label: "Simulate It" },
  { id: "lessons",  n: "04", label: "Lessons" },
  { id: "mentor",   n: "05", label: "Ask the Mentor" },
];

function SectionHeading({ n, children, tone }) {
  return (
    <h2 className="flex items-baseline gap-3 font-display font-semibold text-[1.35rem] text-ink mb-5">
      <span className="font-mono text-[12px] text-indigo-400/90" aria-hidden>{n}</span>
      {tone ? (
        <span className={`font-mono text-[11px] rounded px-2 py-0.5 self-center ${tone}`}>{children}</span>
      ) : (
        <span>{children}</span>
      )}
    </h2>
  );
}

export default function CaseStudyDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [cs, setCs] = useState(null);
  const [error, setError] = useState(null);

  // Mentor
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [mentorError, setMentorError] = useState(null);

  useEffect(() => {
    setCs(null);
    setError(null);
    setAnswer(null);
    api.getCaseStudy(slug).then(setCs).catch((e) => setError(e.message));
  }, [slug]);

  const ask = async (q) => {
    const text = (q || question).trim();
    if (!text) return;
    setAsking(true);
    setMentorError(null);
    try {
      const res = await api.mentor(slug, text);
      setAnswer({ q: text, a: res.answer });
      setQuestion("");
    } catch (e) {
      setMentorError(e.status === 503 ? "The AI mentor isn't configured on this server yet." : e.message);
    } finally {
      setAsking(false);
    }
  };

  const simulateThis = () => {
    navigate("/sandbox", {
      state: { graph: cs.starter_graph, loadRps: cs.starter_load_rps },
    });
  };

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-base px-6">
        <div className="text-center">
          <p className="text-muted text-sm mb-4">{error}</p>
          <Link to="/case-studies" className="text-indigo-300 text-sm hover:text-indigo-200">← All case studies</Link>
        </div>
      </div>
    );
  }

  if (!cs) {
    return (
      <div className="bg-base min-h-screen">
        <div className="max-w-3xl mx-auto px-6 py-16 flex flex-col gap-4">
          <div className="h-8 w-2/3 rounded bg-surface animate-pulse" />
          <div className="h-40 rounded-xl bg-surface animate-pulse" />
          <div className="h-64 rounded-xl bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  const color = BRAND_COLOR[cs.company] ?? "#7C5CFF";
  const scale = Object.entries(cs.scale_context || {});
  const keyLesson = cs.lessons?.[0];

  return (
    <div className="bg-base min-h-screen">
      <div className="max-w-3xl xl:max-w-5xl mx-auto px-6 xl:grid xl:grid-cols-[168px_minmax(0,1fr)] xl:gap-12">

        {/* Sticky mini table of contents (xl and up) */}
        <nav
          aria-label="On this page"
          className="hidden xl:block pt-[7.5rem] pb-16"
        >
          <div className="sticky top-24">
            <p className="font-mono text-[10px] text-muted/50 uppercase tracking-[0.14em] mb-3">
              On this page
            </p>
            <ul className="flex flex-col gap-1 border-l border-white/[0.06]">
              {TOC.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="flex items-baseline gap-2 pl-3 py-1 -ml-px border-l border-transparent
                               text-[12.5px] text-muted hover:text-ink hover:border-indigo-500/60 transition-colors duration-150"
                  >
                    <span className="font-mono text-[10px] text-indigo-400/70" aria-hidden>{t.n}</span>
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="max-w-3xl min-w-0">

          {/* Header */}
          <div className="pt-12 sm:pt-16 pb-8 border-b border-white/[0.05]">
            <Link to="/case-studies" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink mb-6">
              <ArrowLeft size={13} /> All case studies
            </Link>
            <div className="flex items-center gap-2.5 mb-4">
              <BrandIcon company={cs.company} size={22} />
              <span className="font-mono text-xs tracking-wide" style={{ color }}>{cs.company}</span>
              <span className={`ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full ${DIFFICULTY_BADGE[cap(cs.difficulty)] || ""}`}>
                {cap(cs.difficulty)}
              </span>
            </div>
            <h1 className="font-display font-semibold text-3xl sm:text-[2.5rem] leading-[1.15] tracking-[-0.02em] text-ink mb-4" style={{ textWrap: "balance" }}>
              {cs.title}
            </h1>
            <blockquote className="font-read border-l-2 pl-4 italic text-[1.0625rem] text-muted leading-relaxed max-w-[58ch]" style={{ borderColor: color + "70" }}>
              {cs.one_liner}
            </blockquote>
          </div>

          {/* Scale context */}
          {scale.length > 0 && (
            <div className="py-6 border-b border-white/[0.05] grid grid-cols-2 sm:grid-cols-4 gap-4">
              {scale.slice(0, 4).map(([k, v]) => (
                <div key={k}>
                  <p className="font-display text-[1.35rem] font-bold text-ink leading-tight">{v}</p>
                  <p className="font-mono text-[10px] text-muted/60 uppercase tracking-wider mt-1">{k.replaceAll("_", " ")}</p>
                </div>
              ))}
            </div>
          )}

          {/* Problem */}
          <section id="problem" className="py-10 scroll-mt-24 border-b border-white/[0.04]">
            <SectionHeading n="01" tone="text-red-400/90 border border-red-500/25 bg-red-500/[0.07]">
              THE PROBLEM
            </SectionHeading>
            <Prose text={cs.problem} className={PROSE_TINT} />
          </section>

          {/* Solution */}
          <section id="solution" className="py-10 scroll-mt-24 border-b border-white/[0.04]">
            <SectionHeading n="02" tone="text-emerald-400/90 border border-emerald-500/25 bg-emerald-500/[0.07]">
              THE SOLUTION
            </SectionHeading>
            <Prose text={cs.solution} className={PROSE_TINT} />

            {/* Key takeaway callout — the one sentence to keep */}
            {keyLesson && (
              <aside className="mt-6 rounded-lg border-l-2 border-indigo-500/70 bg-indigo-500/[0.06] px-4 py-3.5 max-w-[62ch]">
                <p className="font-mono text-[10px] text-indigo-300 tracking-[0.14em] uppercase mb-1.5">★ Remember</p>
                <p className="font-read text-[0.95rem] text-ink leading-relaxed">{keyLesson}</p>
              </aside>
            )}

            {/* Components involved */}
            {cs.components?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap mt-6">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted/60">Built with</span>
                {cs.components.map((t) => {
                  const comp = COMPONENT_BY_TYPE[t];
                  if (!comp) return null;
                  const Icon = comp.icon;
                  const c = CATEGORY_COLOR[comp.category];
                  return (
                    <span key={t} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink/80 bg-surface border border-white/[0.07] rounded px-2 py-1">
                      <Icon size={11} style={{ color: c }} aria-hidden /> {comp.label}
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          {/* Simulate This */}
          {cs.starter_graph && (
            <section id="simulate" className="my-10 scroll-mt-24 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] p-6">
              <h2 className="flex items-center gap-2 font-display font-semibold text-[1.15rem] text-ink mb-2">
                <Play size={16} className="text-indigo-400" aria-hidden /> Simulate this incident
              </h2>
              <p className="text-[0.875rem] text-muted leading-relaxed mb-4 max-w-[58ch]">
                {cs.simulate_prompt || "Load the pre-incident architecture onto the canvas and watch it break under real load — then fix it."}
              </p>
              <button
                type="button"
                onClick={simulateThis}
                className="btn-primary inline-flex items-center gap-2 text-white text-[13.5px] font-medium rounded-lg px-5 py-2.5"
              >
                Open on canvas <ArrowRight size={14} />
              </button>
            </section>
          )}

          {/* Lessons */}
          {cs.lessons?.length > 0 && (
            <section id="lessons" className="pb-10 scroll-mt-24 border-b border-white/[0.04]">
              <SectionHeading n="04">
                <span className="inline-flex items-center gap-2">
                  <GraduationCap size={18} className="text-indigo-400" aria-hidden /> What to take away
                </span>
              </SectionHeading>
              <ol className="flex flex-col gap-3">
                {cs.lessons.map((l, i) => (
                  <li key={i} className="flex gap-3.5 bg-surface border border-white/[0.06] rounded-lg px-4 py-3">
                    <span className="font-mono text-[11px] text-indigo-400 mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-read text-[0.9375rem] text-ink/90 leading-relaxed">{l}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* AI mentor */}
          <section id="mentor" className="pt-10 pb-24 scroll-mt-24">
            <SectionHeading n="05">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={17} className="text-indigo-400" aria-hidden /> Ask about this study
              </span>
            </SectionHeading>
            <p className="text-[0.875rem] text-muted leading-relaxed mb-4 max-w-[58ch] -mt-2">
              A mentor scoped to this case study — it knows the problem, the solution, and the scale numbers above.
            </p>

            {answer && (
              <div className="mb-4 rounded-xl border border-white/[0.07] bg-surface p-5">
                <p className="text-[12.5px] text-muted mb-3 italic">"{answer.q}"</p>
                <p className="font-read text-[0.9375rem] text-ink/85 leading-relaxed whitespace-pre-wrap">{answer.a}</p>
              </div>
            )}
            {mentorError && <p className="mb-3 text-[12.5px] text-muted">{mentorError}</p>}

            <form
              onSubmit={(e) => { e.preventDefault(); ask(); }}
              className="flex gap-2"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`e.g. Why didn't ${cs.company} just add more servers?`}
                className="flex-1 bg-surface border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-ink
                           placeholder:text-muted/50 outline-none focus:border-indigo-500/60"
                aria-label="Your question about this case study"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                className="btn-primary flex items-center gap-2 text-white text-[13px] font-medium rounded-lg px-4 disabled:opacity-40"
              >
                {asking ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                Ask
              </button>
            </form>
            <button
              type="button"
              onClick={() => ask("Explain this case study like I'm a junior developer.")}
              disabled={asking}
              className="mt-2.5 font-mono text-[11px] text-indigo-300/80 hover:text-indigo-200 disabled:opacity-40"
            >
              → Explain this like I'm a junior dev
            </button>
          </section>

        </div>
      </div>
    </div>
  );
}
