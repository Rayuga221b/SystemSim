// Paginated component showcase: 3 cards per page on mobile, 6 on desktop,
// native CSS scroll-snap + a smooth-scrolled "page" jump on the arrow
// buttons. Deliberately not a JS carousel library (Embla previously here) —
// Embla measures slide widths once on init and doesn't reliably re-measure
// across viewport changes that don't fire a real browser resize event, which
// left it broken on mobile. Scroll-snap has no width state to go stale: the
// browser owns scrolling and swiping, we just point it at whole pages.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ComponentCard from "./ComponentCard";

export default function ComponentCarousel({ items }) {
  const scrollerRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const updateEdges = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, []);

  const page = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label="Previous components"
        className="shrink-0 w-9 h-9 rounded-full border border-hairline/[0.1] bg-elevated text-muted
                   flex items-center justify-center transition-all duration-150
                   hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400
                   disabled:opacity-25 disabled:pointer-events-none"
      >
        <ChevronLeft size={16} />
      </button>

      <div
        ref={scrollerRef}
        className="no-scrollbar grid grid-flow-col grid-rows-1 auto-cols-[calc((100%-2*0.625rem)/3)] sm:auto-cols-[calc((100%-5*0.75rem)/6)]
                   gap-2.5 sm:gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      >
        {items.map((c, i) => (
          <div key={c.label} className="snap-start">
            <ComponentCard c={c} index={i} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label="Next components"
        className="shrink-0 w-9 h-9 rounded-full border border-hairline/[0.1] bg-elevated text-muted
                   flex items-center justify-center transition-all duration-150
                   hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400
                   disabled:opacity-25 disabled:pointer-events-none"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
