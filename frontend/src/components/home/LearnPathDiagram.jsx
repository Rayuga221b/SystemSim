// Self-contained SVG roadmap diagram for the Home "Learn library" section.
// No external assets — every color is inline and tuned to the dark UI's
// indigo / violet / sky / emerald accents. Kept standalone so Home.jsx
// stays readable. Responsive via viewBox + w-full (see usage in Home.jsx).

// A structured path: a spine of curriculum modules (Foundations → … → Scaling)
// that feeds into the loop the whole site is built around — Learn → Practice →
// Simulate.

const MODULES = [
  { label: "Foundations", stroke: "#7C5CFF", fill: "rgba(124,92,255,0.12)" },
  { label: "Storage",     stroke: "#8B5CF6", fill: "rgba(139,92,246,0.12)" },
  { label: "Caching",     stroke: "#818CF8", fill: "rgba(129,140,248,0.12)" },
  { label: "Networking",  stroke: "#60A5FA", fill: "rgba(96,165,250,0.12)"  },
  { label: "Messaging",   stroke: "#38BDF8", fill: "rgba(56,189,248,0.12)"  },
  { label: "Scaling",     stroke: "#34D399", fill: "rgba(52,211,153,0.12)"  },
];

// Layout constants for the module spine
const NODE_W = 104;
const NODE_H = 40;
const GAP = 14;
const START_X = 24;
const SPINE_Y = 60;

export default function LearnPathDiagram() {
  return (
    <svg
      viewBox="0 0 740 300"
      className="w-full max-w-full h-auto"
      role="img"
      aria-label="A structured system-design roadmap: modules from Foundations to Scaling that feed a Learn, Practice, Simulate loop."
    >
      <defs>
        <linearGradient id="lp-spine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#7C5CFF" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#34D399" stopOpacity="0.5" />
        </linearGradient>
        <marker id="lp-arr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <polygon points="0 0,6 3,0 6" fill="#7C5CFF" fillOpacity="0.55" />
        </marker>
        <filter id="lp-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Section label for the module spine ── */}
      <text x={START_X} y="30" fill="#808098" fontSize="11"
        fontFamily="JetBrains Mono,monospace" letterSpacing="0.08em">
        76-LESSON ROADMAP
      </text>

      {/* ── Connecting line under the module spine ── */}
      <line
        x1={START_X + 6} y1={SPINE_Y + NODE_H + 16}
        x2={START_X + MODULES.length * (NODE_W + GAP) - GAP - 6} y2={SPINE_Y + NODE_H + 16}
        stroke="url(#lp-spine)" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round"
      />

      {/* ── Module nodes ── */}
      {MODULES.map((m, i) => {
        const x = START_X + i * (NODE_W + GAP);
        const cx = x + NODE_W / 2;
        const dotY = SPINE_Y + NODE_H + 16;
        return (
          <g key={m.label}>
            {/* arrow between consecutive modules */}
            {i < MODULES.length - 1 && (
              <line
                x1={x + NODE_W} y1={SPINE_Y + NODE_H / 2}
                x2={x + NODE_W + GAP} y2={SPINE_Y + NODE_H / 2}
                stroke="#7C5CFF" strokeOpacity="0.35" strokeWidth="1.5"
                markerEnd="url(#lp-arr)"
              />
            )}
            <rect
              x={x} y={SPINE_Y} width={NODE_W} height={NODE_H} rx="9"
              fill={m.fill} stroke={m.stroke} strokeOpacity="0.55" strokeWidth="1.5"
            />
            <text x={cx} y={SPINE_Y + NODE_H / 2 + 4} textAnchor="middle"
              fill="#EDEDF2" fontSize="12" fontFamily="Inter,system-ui,sans-serif" fontWeight="500">
              {m.label}
            </text>
            {/* progress dot tying node to the spine line */}
            <circle cx={cx} cy={dotY} r="3" fill={m.stroke} fillOpacity="0.9" />
            <line x1={cx} y1={SPINE_Y + NODE_H} x2={cx} y2={dotY - 3}
              stroke={m.stroke} strokeOpacity="0.3" strokeWidth="1" />
          </g>
        );
      })}

      {/* ── The learn → practice → simulate loop it feeds ── */}
      {/* Downward connector from the roadmap into the loop */}
      <path
        d="M370,150 C370,178 370,178 370,196"
        fill="none" stroke="#7C5CFF" strokeOpacity="0.4" strokeWidth="1.5"
        strokeDasharray="4 4" markerEnd="url(#lp-arr)"
      />

      {(() => {
        const loop = [
          { label: "Read a chapter", sub: "Learn",    x: 96,  stroke: "#8B5CF6", fill: "rgba(139,92,246,0.10)" },
          { label: "Build it",       sub: "Practice", x: 300, stroke: "#60A5FA", fill: "rgba(96,165,250,0.10)"  },
          { label: "Break it",       sub: "Simulate", x: 504, stroke: "#34D399", fill: "rgba(52,211,153,0.10)"  },
        ];
        const w = 140, h = 56, y = 222;
        return (
          <g>
            {loop.map((n, i) => (
              <g key={n.sub}>
                {i < loop.length - 1 && (
                  <line
                    x1={n.x + w} y1={y + h / 2}
                    x2={loop[i + 1].x} y2={y + h / 2}
                    stroke="#7C5CFF" strokeOpacity="0.4" strokeWidth="1.5"
                    markerEnd="url(#lp-arr)"
                  />
                )}
                <rect x={n.x} y={y} width={w} height={h} rx="12"
                  fill={n.fill} stroke={n.stroke} strokeOpacity="0.6" strokeWidth="1.5"
                  filter={i === 2 ? "url(#lp-glow)" : undefined} />
                <text x={n.x + w / 2} y={y + 24} textAnchor="middle"
                  fill="#EDEDF2" fontSize="13" fontFamily="Inter,system-ui,sans-serif" fontWeight="600">
                  {n.label}
                </text>
                <text x={n.x + w / 2} y={y + 41} textAnchor="middle"
                  fill={n.stroke} fillOpacity="0.85" fontSize="10"
                  fontFamily="JetBrains Mono,monospace" letterSpacing="0.1em">
                  {n.sub.toUpperCase()}
                </text>
              </g>
            ))}
            {/* loop-back arc from Simulate → Learn, closing the cycle */}
            <path
              d={`M${504 + w / 2},${y + h + 4} C${504 + w / 2},292 ${96 + w / 2},292 ${96 + w / 2},${y + h + 4}`}
              fill="none" stroke="#7C5CFF" strokeOpacity="0.25" strokeWidth="1.5"
              strokeDasharray="3 5" markerEnd="url(#lp-arr)"
            />
          </g>
        );
      })()}
    </svg>
  );
}
