import { useEffect } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Navbar       from "@/components/layout/Navbar";
import Footer       from "@/components/layout/Footer";
import SplashLoader from "@/components/layout/SplashLoader";
import { useStore } from "@/store";

// Full-bleed canvas routes: no footer, the workspace owns the viewport.
const CANVAS_ROUTES = [/^\/sandbox/, /^\/challenges\/[^/]+$/];

// ─── Page transition ──────────────────────────────────────────────────────────
// AnimatePresence mode="wait" lets the exiting page finish before the next starts.
// initial={false} skips the animation on the very first render (home page entrance
// is handled by its own hero variants).

function PageWrapper() {
  const location    = useLocation();
  const shouldReduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.main
        key={location.pathname}
        className="flex-1"
        initial={{ opacity: 0, y: shouldReduce ? 0 : 6 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        }}
        exit={{
          opacity: 0,
          transition: { duration: 0.14, ease: "easeIn" },
        }}
      >
        <Outlet />
      </motion.main>
    </AnimatePresence>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const location = useLocation();
  const initAuth = useStore((s) => s.initAuth);

  useEffect(() => { initAuth(); }, [initAuth]);

  const isCanvasRoute = CANVAS_ROUTES.some((r) => r.test(location.pathname));

  return (
    <SplashLoader>
      <div className="min-h-screen flex flex-col bg-base">
        <Navbar />
        <PageWrapper />
        {!isCanvasRoute && <Footer />}
      </div>
    </SplashLoader>
  );
}
