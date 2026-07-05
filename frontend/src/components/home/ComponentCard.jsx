// Single component card used in the 14-component showcase carousel on the home page.
// Responsive: 88×88px on mobile, 108×108px on sm+, 130×130px on lg+.
// Each card "breathes" at a staggered phase driven by the `index` prop.

export default function ComponentCard({ c, index = 0 }) {
  return (
    <div
      className={`
        w-[88px] h-[88px] sm:w-[108px] sm:h-[108px] lg:w-[130px] lg:h-[130px]
        rounded-xl sm:rounded-2xl border bg-gradient-to-br shrink-0 select-none
        flex flex-col items-center justify-center gap-2
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
        <p className="font-mono text-[9px] sm:text-[10px] lg:text-[11px] font-medium text-ink leading-tight">{c.label}</p>
        <p className={`font-mono text-[8px] sm:text-[9px] lg:text-[10px] ${c.iconColor} opacity-50 mt-0.5`}>{c.cat}</p>
      </div>
    </div>
  );
}
