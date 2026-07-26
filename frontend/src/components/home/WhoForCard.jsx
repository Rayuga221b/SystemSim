// Flip card for the "Who uses SystemSim" grid. Front is the description,
// back is a direct link to the page that actually serves that purpose.
// Deliberately CSS-only (transform + backface-visibility, both GPU-composited)
// instead of a JS animation — no per-frame work, nothing to jank the page,
// no added dependency. Click/tap and Enter/Space both flip; the back link is
// a real <Link>, not a second page navigation bolted onto the flip handler.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function WhoForCard({ item }) {
  const [flipped, setFlipped] = useState(false);
  const toggle = () => setFlipped((f) => !f);

  return (
    <div
      className="relative [perspective:1200px]"
      role="button"
      tabIndex={0}
      aria-label={`${item.title}. ${flipped ? "Showing link — activate to flip back." : "Activate to flip and reveal a link."}`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      }}
    >
      <div
        className="relative transition-transform duration-500 ease-out [transform-style:preserve-3d] cursor-pointer hover-shake"
        style={{ transform: flipped ? "rotateY(180deg)" : "none" }}
      >
        {/* Front — spacer only (not `absolute`) so the flip card's height
            comes from this content; the back face matches it via inset-0. */}
        <div className="[backface-visibility:hidden] bg-elevated border border-hairline/[0.07] rounded-xl p-5 hover:border-indigo-500/20 transition-colors duration-150">
          <span className={`${item.iconBg} ${item.iconColor} w-8 h-8 rounded-lg flex items-center justify-center mb-4`}>
            {item.icon}
          </span>
          <h3 className="font-semibold text-ink text-sm mb-2">{item.title}</h3>
          <p className="text-muted text-xs leading-relaxed">{item.desc}</p>
        </div>

        {/* Back — heading + link centered, both bumped up a size from the front. */}
        <div
          className="absolute inset-0 [backface-visibility:hidden] bg-elevated border border-indigo-500/25 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-3"
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className={`${item.iconBg} ${item.iconColor} w-8 h-8 rounded-lg flex items-center justify-center`}>
            {item.icon}
          </span>
          <p className="text-ink text-base font-semibold leading-snug">{item.title}</p>
          <Link
            to={item.to}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200 transition-colors"
          >
            {item.cta} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
