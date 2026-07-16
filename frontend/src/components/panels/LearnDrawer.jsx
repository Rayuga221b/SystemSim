// The Learn drawer: theory where it's applied. Opens from the palette or the
// properties panel and renders the concept card for one component.
// Text color varies on purpose: the lede is bright, explanations are dimmer,
// and the interview line sits in a tinted "say this" callout — not a wall of
// uniform white.
import { useEffect } from "react";
import { X, Lightbulb, Building2, MessageSquareQuote, AlertTriangle, Activity } from "lucide-react";
import { useStore } from "@/store";
import { COMPONENT_BY_TYPE, CATEGORY_COLOR } from "@/lib/components";
import { CONCEPTS } from "@/data/concepts";

export default function LearnDrawer() {
  const type = useStore((s) => s.learnComponent);
  const closeLearn = useStore((s) => s.closeLearn);

  useEffect(() => {
    if (!type) return;
    const onKey = (e) => e.key === "Escape" && closeLearn();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [type, closeLearn]);

  if (!type) return null;
  const comp = COMPONENT_BY_TYPE[type];
  const concept = CONCEPTS[type];
  if (!comp || !concept) return null;
  const Icon = comp.icon;
  const color = CATEGORY_COLOR[comp.category];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && closeLearn()}
      role="dialog"
      aria-modal="true"
      aria-label={`About ${comp.label}`}
    >
      <div className="w-[440px] max-w-full h-full bg-surface border-l border-hairline/[0.08] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-hairline/[0.06] px-6 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a` }}>
            <Icon size={17} style={{ color }} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-semibold text-ink leading-tight">{comp.label}</h2>
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mt-0.5">{comp.category}</p>
          </div>
          <button type="button" onClick={closeLearn} className="text-muted hover:text-ink p-1.5 -m-1.5" aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Lede — the mental model, set brighter and with a category rule */}
          <p
            className="text-[14px] text-ink leading-relaxed border-l-2 pl-3.5"
            style={{ borderColor: `${color}66` }}
          >
            {concept.what}
          </p>

          <Section icon={Activity} title="Under load" color="#9B85FF">
            <p className="text-[12.5px] text-muted leading-relaxed">{concept.how}</p>
          </Section>

          <Section icon={Lightbulb} title="Reach for it when" color="#34D399">
            <ul className="flex flex-col gap-1.5">
              {concept.whenToUse.map((w, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] text-ink/85 leading-relaxed">
                  <span className="text-emerald-400/80 mt-[3px] shrink-0" aria-hidden>▸</span>{w}
                </li>
              ))}
            </ul>
          </Section>

          <Section icon={Building2} title="In the wild" color="#38BDF8">
            <p className="text-[12.5px] text-muted leading-relaxed">{concept.realWorld}</p>
          </Section>

          {/* The one paragraph worth memorizing — boxed so it reads as a quote */}
          <Section icon={MessageSquareQuote} title="Saying it in an interview" color="#9B85FF">
            <blockquote className="rounded-lg border-l-2 border-indigo-500/70 bg-indigo-500/[0.07] px-3.5 py-3">
              <p className="font-mono text-[9.5px] text-indigo-300 tracking-[0.14em] uppercase mb-1.5">★ Say this</p>
              <p className="text-[12.5px] text-ink leading-relaxed">{concept.interview}</p>
            </blockquote>
          </Section>

          <Section icon={AlertTriangle} title="Classic mistakes" color="#FBBF24">
            <ul className="flex flex-col gap-1.5 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] px-3.5 py-3">
              {concept.pitfalls.map((p, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] text-ink/80 leading-relaxed">
                  <span className="text-amber-400/80 mt-[3px] shrink-0" aria-hidden>▸</span>{p}
                </li>
              ))}
            </ul>
          </Section>

          <div className="h-2" />
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, color, children }) {
  return (
    <section className="border-t border-hairline/[0.04] pt-5 first:border-0 first:pt-0">
      <h3 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted/80 mb-2">
        <Icon size={12} style={{ color }} aria-hidden /> {title}
      </h3>
      {children}
    </section>
  );
}
