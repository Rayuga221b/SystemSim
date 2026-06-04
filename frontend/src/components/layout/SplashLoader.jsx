import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 select-none"
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
              <span className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-[0_0_0_1px_rgba(99,102,241,0.2),0_8px_32px_rgba(0,0,0,0.6)]">
                <img
                  src="/logo.png"
                  alt=""
                  aria-hidden="true"
                  className="w-10 h-10 object-contain"
                />
              </span>
              <span
                className="font-display font-semibold text-[1.0625rem] tracking-tight"
                style={{ color: "#EDEDF2" }}
              >
                System<span style={{ color: "#818CF8" }}>Sim</span>
              </span>
            </motion.div>

            {/* Spinner */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className="w-8 h-8 rounded-full animate-spin"
              style={{
                border: "3px solid rgba(99,102,241,0.18)",
                borderTopColor: "rgba(99,102,241,0.9)",
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
