// Single component card used in the 14-component showcase carousel on the home page.
// Fills its parent cell (the carousel sizes cells so exactly 3 fit on mobile /
// 6 on desktop — see ComponentCarousel.jsx) rather than carrying its own fixed
// pixel size, so the "how many per page" logic lives in one place.
// Each card "breathes" at a staggered phase driven by the `index` prop.

export default function ComponentCard({ c, index = 0 }) {
  return (
    <div
      className={`
        w-full aspect-square
        rounded-xl sm:rounded-2xl border bg-gradient-to-br select-none
        flex flex-col items-center justify-center gap-1.5 sm:gap-2 p-1.5
        ${c.grad} ${c.border}
      `}
      style={{
        animation: `card-breathe 3s ease-in-out ${(index * 0.35).toFixed(2)}s infinite`,
      }}
    >
      <span className={`w-7 h-7 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-lg sm:rounded-xl ${c.iconBg} ${c.iconColor} flex items-center justify-center`}>
        {c.icon}
      </span>
      <div className="text-center px-1">
        {/* Tile bg (c.grad) is a fixed dark gradient in both themes — label
            stays a fixed light color instead of theme-reactive `text-ink`,
            which would go dark-on-dark once the site is in light mode.
            minHeight is in `em` (relative to this element's own font-size,
            which already varies per breakpoint) so it reserves exactly two
            lines at every size — a one-line label ("CDN") and a two-line one
            ("Message Queue") then take up the same vertical space, keeping
            the icon above at the same height on every card instead of
            shifting per card based on how much the label wraps. */}
        <p
          className="font-mono text-[9px] sm:text-[10px] lg:text-[11px] font-medium text-white/90 leading-tight flex items-center justify-center"
          style={{ minHeight: "2.5em" }}
        >
          {c.label}
        </p>
        <p className={`font-mono text-[8px] sm:text-[9px] lg:text-[10px] ${c.iconColor} opacity-50 mt-0.5`}>{c.cat}</p>
      </div>
    </div>
  );
}
