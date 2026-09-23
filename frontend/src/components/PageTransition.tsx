import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Smooth screen-to-screen transitions (team scope item, esp. for the
 * risk-result and pause/verify screens -- those are the moments the app
 * most needs to feel calm rather than alarming). A gentle fade + small
 * vertical settle, not a flashy slide, on purpose.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
