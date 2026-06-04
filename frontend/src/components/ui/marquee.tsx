import { cn } from "@/lib/utils";
import { ReactNode } from "react";

// Adapted from cta-with-marquee. Removed 'use client' and next/image
// (not Next.js — this is Vite/React). Speed is controlled via the --duration
// CSS custom property set on the wrapper.

interface MarqueeProps {
  children: ReactNode;
  /** Pause the scroll when the user hovers anywhere inside the strip. */
  pauseOnHover?: boolean;
  /** Reverse scroll direction (right → left becomes left → right). */
  reverse?: boolean;
  className?: string;
  /** Scroll duration in seconds. Lower = faster. Default 40. */
  speed?: number;
}

export function Marquee({
  children,
  pauseOnHover = false,
  reverse = false,
  className,
  speed = 40,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden [--gap:0.75rem] [gap:var(--gap)]",
        className,
      )}
      style={{ "--duration": `${speed}s` } as React.CSSProperties}
    >
      {/* First copy */}
      <div
        className={cn(
          "flex min-w-full shrink-0 items-center justify-around gap-[var(--gap)] animate-marquee-smooth",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
      >
        {children}
      </div>

      {/* Seamless duplicate — hidden from assistive tech */}
      <div
        aria-hidden="true"
        className={cn(
          "flex min-w-full shrink-0 items-center justify-around gap-[var(--gap)] animate-marquee-smooth",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
