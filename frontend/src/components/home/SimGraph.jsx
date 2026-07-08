// Animated SVG simulation diagram used in the Home hero section.
// Kept as a standalone component so Home.jsx stays readable.

const edge = (delay = 0) => ({
  stroke: "#7C5CFF", strokeOpacity: 0.4, strokeWidth: 1.5,
  fill: "none", strokeDasharray: "5 4",
  animation: `flow-edge 2s linear ${delay}s infinite`,
});

export default function SimGraph() {
  return (
    <svg
      viewBox="0 0 700 200"
      className="w-full max-w-2xl mx-auto"
      aria-label="System diagram: Client → API Gateway → Load Balancer → two App Servers → Database (bottleneck)"
    >
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <polygon points="0 0,6 3,0 6" fill="#7C5CFF" fillOpacity="0.45" />
        </marker>
      </defs>

      {/* Edges */}
      <path d="M120,100 L148,100"                  style={edge(0)}   markerEnd="url(#arr)" />
      <path d="M260,100 L288,100"                  style={edge(0.5)} markerEnd="url(#arr)" />
      <path d="M400,100 C416,100 428,62 428,62"   style={edge(1)}   markerEnd="url(#arr)" />
      <path d="M400,100 C416,100 428,138 428,138" style={edge(0.3)} markerEnd="url(#arr)" />
      <path d="M540,62 C555,62 568,100 568,100"   style={edge(0.8)} markerEnd="url(#arr)" />
      <path d="M540,138 C555,138 568,100 568,100" style={edge(1.3)} markerEnd="url(#arr)" />

      {/* Nodes */}
      <rect x="10"  y="83" width="110" height="34" rx="5" fill="#15151C" stroke="rgba(124, 92, 255,0.25)" strokeWidth="1.5" />
      <text x="65"  y="104" textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">Client</text>

      <rect x="150" y="83" width="110" height="34" rx="5" fill="#15151C" stroke="rgba(124, 92, 255,0.25)" strokeWidth="1.5" />
      <text x="205" y="97"  textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">API</text>
      <text x="205" y="110" textAnchor="middle" fill="#808098" fontSize="8"  fontFamily="JetBrains Mono,monospace">Gateway</text>

      <rect x="290" y="83" width="110" height="34" rx="5" fill="#15151C" stroke="rgba(124, 92, 255,0.25)" strokeWidth="1.5" />
      <text x="345" y="97"  textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">Load</text>
      <text x="345" y="110" textAnchor="middle" fill="#808098" fontSize="8"  fontFamily="JetBrains Mono,monospace">Balancer</text>

      <rect x="430" y="44"  width="110" height="34" rx="5" fill="#15151C" stroke="rgba(124, 92, 255,0.2)" strokeWidth="1.5" />
      <text x="485" y="58"  textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">App Server</text>
      <text x="485" y="71"  textAnchor="middle" fill="#808098" fontSize="8"  fontFamily="JetBrains Mono,monospace">instance 1</text>

      <rect x="430" y="122" width="110" height="34" rx="5" fill="#15151C" stroke="rgba(124, 92, 255,0.2)" strokeWidth="1.5" />
      <text x="485" y="136" textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">App Server</text>
      <text x="485" y="149" textAnchor="middle" fill="#808098" fontSize="8"  fontFamily="JetBrains Mono,monospace">instance 2</text>

      {/* Bottleneck database — pulsing amber border */}
      <rect x="570" y="83" width="110" height="34" rx="5"
        fill="rgba(245,158,11,0.07)" stroke="#F59E0B" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.28))" }}>
        <animate attributeName="strokeOpacity" values="0.55;1;0.55" dur="2s" repeatCount="indefinite" />
      </rect>
      <text x="625" y="97"  textAnchor="middle" fill="#EDEDF2" fontSize="10" fontFamily="JetBrains Mono,monospace">Database</text>
      <text x="625" y="110" textAnchor="middle" fill="#F59E0B" fontSize="8"  fontFamily="JetBrains Mono,monospace">⚠ bottleneck</text>
    </svg>
  );
}
