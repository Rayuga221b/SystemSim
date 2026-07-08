// Brand mark — "Pulse Node": three graph nodes tracing an S, the same shape
// as everything a user draws on the canvas. Center node is mint (the
// "healthy / simulating" accent) and can pulse; outer nodes stay neutral so
// the mark reads at favicon size too. See design/systemsim-design-portfolio.html
// for the full exploration and DESIGN.md's "Visual rebrand" note.
export default function Logo({ size = 22, pulse = false, className = "" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label="SystemSim"
      className={className}
    >
      <path d="M86 22 Q50 30 46 60" fill="none" stroke="#7C5CFF" strokeWidth="9" strokeLinecap="round" />
      <path d="M46 60 Q42 90 86 98" fill="none" stroke="#7C5CFF" strokeWidth="9" strokeLinecap="round" />
      <circle cx="86" cy="22" r="10" fill="#F3F5FA" />
      <circle cx="86" cy="98" r="10" fill="#F3F5FA" />
      <circle
        cx="46" cy="60" r="13" fill="#34E2A1"
        className={pulse ? "origin-[46px_60px] animate-logo-pulse" : ""}
      />
    </svg>
  );
}
