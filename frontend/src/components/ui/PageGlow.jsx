// Ambient page backdrop: soft radial color blooms + a faint dot-grid texture,
// anchored to the top of a page. The same recipe used on Home's hero/CTA
// sections and Interview Prep — reused here so every page shares one visual
// language instead of static walls of gray-on-black.
//
// Usage: render as the FIRST child of a `relative` page wrapper (no
// overflow-hidden needed — the backdrop is self-contained within `height`,
// so it never needs clipping and can't produce a hard edge).
export default function PageGlow({ height = 480, blobs, dotOpacity = 0.14 }) {
  const defaultBlobs = [
    { x: "20%", y: "0%",  w: "60%", h: "70%", color: "rgba(124, 92, 255,0.16)" },  // indigo
    { x: "85%", y: "10%", w: "45%", h: "55%", color: "rgba(139,92,246,0.10)" },  // violet
  ];
  const list = blobs || defaultBlobs;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0"
        style={{
          height,
          background: list
            .map((b) => `radial-gradient(ellipse ${b.w} ${b.h} at ${b.x} ${b.y}, ${b.color} 0%, transparent 60%)`)
            .join(", "),
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 dot-grid"
        style={{ height: height * 0.75, opacity: dotOpacity }}
      />
    </>
  );
}
