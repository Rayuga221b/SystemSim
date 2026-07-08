import { Link } from "react-router-dom";
import {
  ArrowRight, LayoutDashboard, Target, BookOpen,
  Monitor, Globe, Shield, GitFork, Gauge, Server, Cpu,
  Database, HardDrive, Archive, Wifi, Layers, Search, Inbox,
  Users, BrainCircuit, AlertTriangle,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { DottedSurface }    from "@/components/ui/dotted-surface";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import ComponentCard from "@/components/home/ComponentCard";
import SimGraph      from "@/components/home/SimGraph";

// ─── Data ────────────────────────────────────────────────────────────────────

const CAROUSEL = [
  { name: "Discord", src: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" },
  { name: "Netflix",  src: "https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg" },
  { name: "Twitter",  src: "https://upload.wikimedia.org/wikipedia/commons/5/53/X_logo_2023_original.svg" },
  { name: "Slack",    src: "https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" },
  { name: "Uber",     src: "https://upload.wikimedia.org/wikipedia/commons/c/cc/Uber_logo_2018.png" },
  { name: "GitHub",   src: "https://upload.wikimedia.org/wikipedia/commons/9/91/Octicons-mark-github.svg" },
  { name: "Amazon",   src: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" },
  { name: "Stripe",   src: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" },
];

// All 14 sandbox components — card-grade data for the marquee showcase
// Each card has its own gradient + border so no two look identical.
const COMPONENT_STRIP = [
  // ── ingress ──────────────────────────────────────────────────────────────
  {
    icon: <Monitor size={18} />, label: "Client", cat: "ingress",
    iconColor: "text-indigo-300", iconBg: "bg-indigo-500/20",
    grad: "from-indigo-900/70 to-blue-900/40", border: "border-indigo-500/30",
  },
  {
    icon: <Globe size={18} />, label: "DNS", cat: "ingress",
    iconColor: "text-violet-300", iconBg: "bg-violet-500/20",
    grad: "from-violet-900/70 to-indigo-900/40", border: "border-violet-500/30",
  },
  {
    icon: <Wifi size={18} />, label: "CDN", cat: "ingress",
    iconColor: "text-blue-300", iconBg: "bg-blue-500/20",
    grad: "from-blue-900/70 to-indigo-900/40", border: "border-blue-500/30",
  },
  {
    icon: <Shield size={18} />, label: "API Gateway", cat: "ingress",
    iconColor: "text-indigo-300", iconBg: "bg-indigo-500/20",
    grad: "from-indigo-900/70 to-violet-900/50", border: "border-indigo-400/30",
  },
  {
    icon: <GitFork size={18} />, label: "Load Balancer", cat: "ingress",
    iconColor: "text-sky-300", iconBg: "bg-sky-500/20",
    grad: "from-sky-900/70 to-blue-900/40", border: "border-sky-500/30",
  },
  {
    icon: <Gauge size={18} />, label: "Rate Limiter", cat: "ingress",
    iconColor: "text-amber-300", iconBg: "bg-amber-500/20",
    grad: "from-amber-900/70 to-orange-900/40", border: "border-amber-500/30",
  },
  // ── compute ───────────────────────────────────────────────────────────────
  {
    icon: <Server size={18} />, label: "App Server", cat: "compute",
    iconColor: "text-amber-300", iconBg: "bg-amber-500/20",
    grad: "from-amber-900/70 to-yellow-900/40", border: "border-amber-400/30",
  },
  {
    icon: <Cpu size={18} />, label: "Worker", cat: "compute",
    iconColor: "text-orange-300", iconBg: "bg-orange-500/20",
    grad: "from-orange-900/70 to-amber-900/40", border: "border-orange-500/30",
  },
  // ── storage ───────────────────────────────────────────────────────────────
  {
    icon: <Database size={18} />, label: "SQL Database", cat: "storage",
    iconColor: "text-emerald-300", iconBg: "bg-emerald-500/20",
    grad: "from-emerald-900/70 to-teal-900/40", border: "border-emerald-500/30",
  },
  {
    icon: <HardDrive size={18} />, label: "NoSQL Database", cat: "storage",
    iconColor: "text-teal-300", iconBg: "bg-teal-500/20",
    grad: "from-teal-900/70 to-emerald-900/40", border: "border-teal-500/30",
  },
  {
    icon: <Archive size={18} />, label: "Object Storage", cat: "storage",
    iconColor: "text-green-300", iconBg: "bg-green-500/20",
    grad: "from-green-900/70 to-emerald-900/40", border: "border-green-500/30",
  },
  {
    icon: <Layers size={18} />, label: "Cache (Redis)", cat: "storage",
    iconColor: "text-rose-300", iconBg: "bg-rose-500/20",
    grad: "from-rose-900/70 to-pink-900/40", border: "border-rose-500/30",
  },
  {
    icon: <Search size={18} />, label: "Search Index", cat: "storage",
    iconColor: "text-cyan-300", iconBg: "bg-cyan-500/20",
    grad: "from-cyan-900/70 to-blue-900/40", border: "border-cyan-500/30",
  },
  // ── async ─────────────────────────────────────────────────────────────────
  {
    icon: <Inbox size={18} />, label: "Message Queue", cat: "async",
    iconColor: "text-violet-300", iconBg: "bg-violet-500/20",
    grad: "from-violet-900/70 to-purple-900/40", border: "border-violet-500/30",
  },
];

// Who the tool is for — 4 use cases
const WHO_FOR = [
  {
    icon: <Target size={16} />,
    iconBg: "bg-indigo-500/12 border border-indigo-500/25",
    iconColor: "text-indigo-400",
    title: "Interview prep",
    desc: "Practice designing URL shorteners, rate limiters, and chat systems. Get scored against reference architectures before your FAANG interview.",
  },
  {
    icon: <BrainCircuit size={16} />,
    iconBg: "bg-amber-500/10 border border-amber-500/20",
    iconColor: "text-amber-400",
    title: "Architecture learning",
    desc: "Drag, connect, simulate. See exactly where bottlenecks form — visually, in real time — rather than reading about them in theory.",
  },
  {
    icon: <AlertTriangle size={16} />,
    iconBg: "bg-rose-500/10 border border-rose-500/20",
    iconColor: "text-rose-400",
    title: "Incident analysis",
    desc: "Walk through how Discord's storage collapsed, how Twitter's fanout failed, and how Netflix survives failures by causing them.",
  },
  {
    icon: <Users size={16} />,
    iconBg: "bg-emerald-500/10 border border-emerald-500/20",
    iconColor: "text-emerald-400",
    title: "Team study sessions",
    desc: "Run group design reviews. Each person builds a solution, then compare your canvases and discuss the tradeoffs together.",
  },
];

// Numbered: genuine learning sequence (explore → practice → study)
const MODES = [
  {
    num: "01",
    icon: <LayoutDashboard size={14} />,
    title: "Sandbox",
    desc: "Free canvas. 14 drag-and-drop components. Wire them, set load, simulate. Bottlenecks surface immediately.",
    action: "Open Sandbox",
    to: "/sandbox",
    iconBg: "bg-indigo-500/12 border border-indigo-500/25",
    iconColor: "text-indigo-400",
    hoverText: "group-hover:text-indigo-400",
  },
  {
    num: "02",
    icon: <Target size={14} />,
    title: "Challenges",
    desc: "Structured scenarios with a reference architecture. Build, submit, see your score, understand where you diverged.",
    action: "Try a challenge",
    to: "/challenges",
    iconBg: "bg-amber-500/10 border border-amber-500/20",
    iconColor: "text-amber-400",
    hoverText: "group-hover:text-amber-400",
  },
  {
    num: "03",
    icon: <BookOpen size={14} />,
    title: "Case Studies",
    desc: "Real production incidents from Discord, Twitter, Netflix, and others. Problem → Solution → Simulate.",
    action: "Browse incidents",
    to: "/case-studies",
    iconBg: "bg-emerald-500/10 border border-emerald-500/20",
    iconColor: "text-emerald-400",
    hoverText: "group-hover:text-emerald-400",
  },
];

// ─── Animation variants ───────────────────────────────────────────────────────

const EASE_EXPO = [0.16, 1, 0.3, 1];

const heroContainer = {
  hidden: {},
  show: (shouldReduce) => ({
    transition: { staggerChildren: shouldReduce ? 0 : 0.08 },
  }),
};

const heroItem = (shouldReduce) => ({
  hidden: { opacity: 0, y: shouldReduce ? 0 : 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_EXPO } },
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const shouldReduce = useReducedMotion();
  const itemVariants = heroItem(shouldReduce);

  return (
    <div className="bg-base">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden isolate">
        <DottedSurface />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background: "radial-gradient(ellipse 50% 55% at 50% 38%, rgba(9,9,14,0.80) 0%, transparent 100%)",
          }}
        />

        <motion.div
          className="relative z-10 max-w-xl mx-auto px-6 pt-12 pb-6 text-center"
          variants={heroContainer}
          custom={shouldReduce}
          initial="hidden"
          animate="show"
        >
          <motion.h1
            variants={itemVariants}
            className="font-display font-semibold text-[1.375rem] md:text-[1.625rem] leading-[1.2] tracking-[-0.02em] text-ink mb-3"
            style={{ textWrap: "balance" }}
          >
            Design. Simulate. Understand.
          </motion.h1>
          <motion.p variants={itemVariants} className="text-muted text-xs leading-relaxed max-w-[42ch] mx-auto mb-6">
            Build distributed architectures on a canvas, simulate load patterns, and study how real systems fail at scale.
          </motion.p>
          <motion.div variants={itemVariants} className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/sandbox" className="inline-flex items-center gap-2 btn-primary text-white text-xs font-semibold px-5 py-2 rounded-lg">
              Open Sandbox <ArrowRight size={12} />
            </Link>
            <Link to="/case-studies" className="inline-flex items-center gap-2 text-xs font-medium text-ink px-5 py-2 rounded-lg border border-white/8 hover:border-indigo-500/35 hover:bg-indigo-500/5 transition-colors duration-150">
              Browse Case Studies
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="relative z-10 max-w-xl mx-auto px-6 pb-12"
          initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: shouldReduce ? 0 : 0.28, duration: 0.65, ease: EASE_EXPO }}
        >
          <div className="bg-surface/90 backdrop-blur-sm border border-indigo-500/18 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/40 border border-amber-500/20" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/20" />
              </span>
              <span className="font-mono text-[11px] text-muted/45 ml-2">simulation preview · 8 200 req/s</span>
            </div>
            <div className="px-4 py-5">
              <SimGraph />
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <span className="font-mono text-xs bg-indigo-500/8 border border-indigo-500/18 rounded-full px-3.5 py-1.5">
                  <span className="text-muted">Latency: </span><span className="text-indigo-400">142ms</span>
                </span>
                <span className="font-mono text-xs bg-indigo-500/8 border border-indigo-500/18 rounded-full px-3.5 py-1.5">
                  <span className="text-muted">Throughput: </span><span className="text-indigo-400">8.2k rps</span>
                </span>
                <span className="font-mono text-xs bg-amber-500/8 border border-amber-500/20 rounded-full px-3.5 py-1.5">
                  <span className="text-muted">Bottleneck: </span><span className="text-amber-400">DB primary</span>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Company carousel — horizontal gradient, lighter centre ── */}
      <section className="relative py-12 overflow-hidden">
        {/* Horizontal gradient: edges match bg-base, centre glows lighter */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              "linear-gradient(to right, #09090E 0%, #0B0B1C 12%, #0F0F2A 50%, #0B0B1C 88%, #09090E 100%)",
              "radial-gradient(ellipse 55% 100% at 50% 50%, rgba(124, 92, 255,0.16) 0%, transparent 65%)",
            ].join(", "),
          }}
        />
        {/* Top + bottom vignettes so the strip doesn't bleed into adjacent sections */}
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-10 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, #09090E, transparent)" }} />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
          style={{ background: "linear-gradient(to top, #09090E, transparent)" }} />

        <p className="relative text-sm font-medium text-muted/55 text-center mb-8 select-none tracking-wide">
          Case studies from
        </p>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 w-32 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, #09090E, transparent)" }} />
          <div className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, #09090E, transparent)" }} />
          <div className="flex animate-marquee gap-16 w-max px-12 items-center">
            {[...CAROUSEL, ...CAROUSEL].map((co, i) => (
              <img
                key={i}
                src={co.src}
                alt={co.name}
                height="26"
                className="h-[26px] w-auto object-contain brightness-0 invert opacity-50 hover:opacity-85 transition-opacity duration-300"
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Component showcase — left: Embla carousel | right: text + CTA ── */}
      {/* Distinct bg (#0D0D1E) separates this from the bg-base sections above and below */}
      {/* No overflow-hidden here — the arrow buttons sit outside the carousel track     */}
      <section className="py-12 sm:py-16 lg:py-20 relative overflow-hidden" style={{ background: "#0D0D1E" }}>
        {/* Subtle indigo glow from the top — visual bridge from the company carousel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(124, 92, 255,0.07) 0%, transparent 70%)",
          }}
        />
        {/* max-w-5xl gives the carousel room to breathe on large screens */}
        <div className="relative max-w-5xl mx-auto px-6">
          {/* 3:2 split — carousel gets 60% so cards have space to grow */}
          <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8 lg:gap-16 items-center">

            {/* Left: Embla carousel — 2 cards on mobile, 3 on sm+ */}
            <div className="px-10"> {/* side padding keeps arrow buttons visible */}
              <Carousel opts={{ loop: true }} className="w-full">
                <CarouselContent className="-ml-4 sm:-ml-5">
                  {COMPONENT_STRIP.map((c, i) => (
                    <CarouselItem key={i} className="pl-4 sm:pl-5 basis-1/2 sm:basis-1/3">
                      <ComponentCard c={c} index={i} />
                    </CarouselItem>
                  ))}
                </CarouselContent>

                <CarouselPrevious
                  className="border-white/10 bg-elevated text-muted hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors duration-150"
                />
                <CarouselNext
                  className="border-white/10 bg-elevated text-muted hover:bg-indigo-500/10 hover:border-indigo-500/30 hover:text-indigo-400 transition-colors duration-150"
                />
              </Carousel>
            </div>

            {/* Right: heading, description, CTA */}
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left gap-5 px-2 sm:px-0">
              <h2
                className="font-display font-semibold text-[1.625rem] sm:text-[1.75rem] md:text-[2rem] text-ink leading-[1.15] tracking-[-0.02em] text-balance"
              >
                14 components,<br />drag and drop
              </h2>
              <p className="text-muted text-sm leading-relaxed max-w-[34ch]">
                Every building block for distributed systems, from ingress to async. Wire them up on the canvas and simulate load in real time.
              </p>
              <Link
                to="/sandbox"
                className="inline-flex items-center gap-2 btn-primary text-white text-sm font-semibold px-6 py-3 rounded-xl"
              >
                Open Sandbox <ArrowRight size={14} />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── Who is this for — 2×2 grid ── */}
      <section className="bg-base border-t border-white/[0.05] py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-display font-semibold text-[1.25rem] text-ink mb-2">Who uses SystemSim</h2>
          <p className="text-muted text-sm mb-10">Built for engineers who learn by doing, not by reading.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {WHO_FOR.map((item) => (
              <div
                key={item.title}
                className="bg-elevated border border-white/[0.07] rounded-xl p-5 hover:border-indigo-500/20 transition-colors duration-150"
              >
                <span className={`${item.iconBg} ${item.iconColor} w-8 h-8 rounded-lg flex items-center justify-center mb-4`}>
                  {item.icon}
                </span>
                <h3 className="font-semibold text-ink text-sm mb-2">{item.title}</h3>
                <p className="text-muted text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Three ways to learn — About3-inspired layout ── */}
      <section className="bg-elevated border-t border-white/[0.05] py-16">
        <div className="max-w-4xl mx-auto px-6">

          {/* 2-column header — title left, description right (from About3) */}
          <div className="mb-10 grid md:grid-cols-2 gap-5 items-end">
            <h2 className="font-display font-semibold text-[1.5rem] text-ink leading-tight">
              Three ways to learn
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              Each mode builds on the last. Work through all three, or jump to where you are in your prep.
            </p>
          </div>

          {/* Asymmetric grid: Sandbox (2/3 wide) + Challenges + Case Studies stacked (1/3) */}
          <div className="grid gap-4 lg:grid-cols-3">

            {/* Sandbox — featured large card, col-span-2 */}
            <Link
              to="/sandbox"
              className="group lg:col-span-2 relative overflow-hidden rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-blue-500/5 p-7 flex flex-col justify-between min-h-[260px] hover:border-indigo-500/35 transition-colors duration-200"
            >
              <div className="absolute inset-0 dot-grid opacity-[0.12]" aria-hidden="true" />
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 rounded-md p-1.5 flex items-center justify-center">
                    <LayoutDashboard size={14} />
                  </span>
                  {/* text-[1rem] not text-base — see Footer.jsx comment: the
                      "base" theme color collides with text-base's font-size utility. */}
                  <span className="font-semibold text-ink text-[1rem]">Sandbox</span>
                </div>
                <p className="text-muted text-sm leading-relaxed max-w-[40ch]">
                  Free canvas. 14 drag-and-drop components. Wire them up, set load, and simulate. Bottlenecks surface immediately.
                </p>
              </div>

              {/* Mini node flow diagram */}
              <div className="relative flex items-center gap-1.5 flex-wrap mt-6">
                {[
                  { label: "Client",  cls: "text-indigo-300 border-indigo-500/30 bg-indigo-500/10" },
                  { label: "Gateway", cls: "text-indigo-300 border-indigo-500/25 bg-indigo-500/8"  },
                  { label: "LB",      cls: "text-sky-300    border-sky-500/25    bg-sky-500/8"      },
                  { label: "Server",  cls: "text-amber-300  border-amber-500/25  bg-amber-500/8"    },
                  { label: "⚠ DB",   cls: "text-amber-400  border-amber-400/40  bg-amber-500/10"   },
                ].flatMap((node, i, arr) => [
                  <span key={`n${i}`} className={`font-mono text-[10px] px-2 py-1 rounded-md border ${node.cls}`}>
                    {node.label}
                  </span>,
                  i < arr.length - 1
                    ? <span key={`a${i}`} className="text-muted/30 text-xs">→</span>
                    : null,
                ])}
              </div>

              <span className="relative flex items-center gap-1.5 mt-5 text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 transition-colors duration-150">
                Open Sandbox <ArrowRight size={13} />
              </span>
            </Link>

            {/* Right column: Challenges + Case Studies stacked */}
            <div className="flex flex-col gap-4">

              {/* Challenges */}
              <Link
                to="/challenges"
                className="group relative overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6 flex-1 hover:border-amber-500/35 transition-colors duration-200"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="bg-amber-500/15 border border-amber-500/25 text-amber-400 rounded-md p-1.5 flex items-center justify-center">
                    <Target size={13} />
                  </span>
                  <span className="font-semibold text-ink text-sm">Challenges</span>
                </div>
                <p className="text-muted text-xs leading-relaxed mb-4">
                  Structured scenarios. Submit your canvas, get scored against a reference architecture.
                </p>
                <span className="text-xs font-semibold text-amber-400 group-hover:text-amber-300 flex items-center gap-1 transition-colors duration-150">
                  Try a challenge <ArrowRight size={12} />
                </span>
              </Link>

              {/* Case Studies */}
              <Link
                to="/case-studies"
                className="group relative overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-6 flex-1 hover:border-emerald-500/35 transition-colors duration-200"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className="bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-md p-1.5 flex items-center justify-center">
                    <BookOpen size={13} />
                  </span>
                  <span className="font-semibold text-ink text-sm">Case Studies</span>
                </div>
                <p className="text-muted text-xs leading-relaxed mb-4">
                  Real incidents from Discord, Twitter, Netflix. Problem → Solution → Simulate.
                </p>
                <span className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 flex items-center gap-1 transition-colors duration-150">
                  Browse incidents <ArrowRight size={12} />
                </span>
              </Link>

            </div>
          </div>

        </div>
      </section>

      {/* ── Final CTA — energetic pre-footer ── */}
      <section className="relative overflow-hidden bg-base pt-28 pb-20 px-6">
        {/* Dotted particle field */}
        <DottedSurface />

        {/* Indigo energy burst — concentrated behind the headline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 65% 75% at 50% 52%, rgba(124, 92, 255,0.24) 0%, rgba(139,92,246,0.12) 40%, transparent 70%)",
              "radial-gradient(ellipse 35% 45% at 50% 48%, rgba(124, 92, 255,0.10) 0%, transparent 55%)",
            ].join(", "),
          }}
        />

        {/* Soft top fade from previous section */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-24"
          style={{ background: "linear-gradient(to bottom, #09090E, transparent)" }}
        />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <p className="font-mono text-xs text-indigo-400/80 tracking-[0.16em] uppercase mb-6">
            Get started
          </p>
          <h2
            className="font-display font-semibold text-[2.25rem] sm:text-[3rem] text-ink leading-[1.08] tracking-[-0.025em] mb-5"
            style={{ textWrap: "balance" }}
          >
            Ready to think<br />in systems?
          </h2>
          <p className="text-muted text-[1rem] leading-relaxed mb-10 max-w-[42ch] mx-auto">
            Start with the sandbox to explore freely, or pick up a structured challenge and get scored.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/sandbox"
              className="inline-flex items-center gap-2 btn-primary text-white text-sm font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-indigo-500/25"
            >
              Open Sandbox <ArrowRight size={14} />
            </Link>
            <Link
              to="/challenges"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted/80 hover:text-ink px-6 py-3.5 rounded-xl border border-white/[0.08] hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-colors duration-150"
            >
              Browse challenges
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
