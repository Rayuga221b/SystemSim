import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "@/components/ui/Logo";

const VISIBLE_MS  = 1800; // how long the splash stays fully opaque
const FADE_OUT_S  = 0.45; // exit transition duration

/**
 * Full-screen branded splash shown on every hard load / browser refresh.
 * The app mounts underneath immediately so there is no pop-in on reveal.
 */
export default function SplashLoader({ children }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="splash"
            // pointer-events-none: opacity animating to 0 doesn't stop the element
            // from capturing clicks — without this, real UI underneath is dead
            // for the whole fade-out (verified: a fixed z-[9999] div was still
            // eating clicks on the app's real buttons during that window).
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 select-none pointer-events-none"
            style={{ backgroundColor: "#09090E" }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: FADE_OUT_S, ease: "easeOut" } }}
          >
            {/* Logo on a lightened tile so it reads against the dark bg */}
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_0_1px_rgba(124,92,255,0.2),0_8px_32px_rgba(0,0,0,0.6)]">
                <Logo size={40} pulse />
              </span>
              <span
                className="font-display font-semibold text-[1.0625rem] tracking-tight"
                style={{ color: "#EDEDF2" }}
              >
                System<span style={{ color: "#9B85FF" }}>Sim</span>
              </span>
            </motion.div>

            {/* Spinner */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                border: "3px solid rgba(124, 92, 255,0.18)",
                borderTopColor: "rgba(124, 92, 255,0.9)",
              }}
              aria-label="Loading"
              role="status"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </>
  );
}
