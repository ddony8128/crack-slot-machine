"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Full-screen jump-scare flash. PRESENTATION ONLY — it neither reads nor writes
 * any game state, RNG, or score; the parent decides when to mount it.
 *
 * - Uses the prebuilt `.scare-overlay` / `.scare-flash` classes from globals.css.
 * - Optionally shows /horror/scare-01.webp; if the asset 404s, onError hides the
 *   image and we fall back to the solid red radial wash so a missing file can
 *   never break the effect.
 * - Auto-dismisses after ~700ms via onDone.
 * - Respects prefers-reduced-motion: renders a brief static tint instead of the
 *   animated flash/shake.
 */
export default function ScareOverlay({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [onDone]);

  if (reduced) {
    // Static, brief tint — no animation, no shake.
    return (
      <div
        aria-hidden
        className="scare-overlay"
        style={{ opacity: 0.85 }}
      />
    );
  }

  return (
    <div aria-hidden className="scare-overlay scare-flash">
      {!imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element -- plain <img> for onError fallback (asset may 404)
        <img
          src="/horror/scare-01.webp"
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
    </div>
  );
}
