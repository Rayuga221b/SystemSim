import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const DURATION_MS  = 1800; // how long the splash stays fully visible
const FADE_OUT_S   = 0.45; // fade-out duration in seconds

/**
 * SplashLoader wraps the whole app.
 * On hard load / refresh it overlays a full-screen branded splash for
 * DURATION_MS ms, then fades out so the app is already mounted beneath it.
 */
export default function SplashLoader({ children }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Splash overlay — z-[9999] sits above everything */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 select-none"
            style={{ backgroundColor: "#09090E" }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: FADE_OUT_S, ease: "easeOut" } }}
          >
            {/* Logo + wordmark */}
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className="w-14 h-14 object-contain"
              />
              <span className="font-display font-semibold text-[1.0625rem] tracking-tight"
                    style={{ color: "#EDEDF2" }}>
                SystemSim
              </span>
            </motion.div>

            {/* Spinner — matches the ClassicLoader pattern: ring with transparent top */}
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

      {/* App renders underneath immediately so it's ready when the splash exits */}
      {children}
    </>
  );
}
