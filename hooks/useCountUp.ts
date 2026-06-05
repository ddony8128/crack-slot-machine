"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Animates a number from its previous value to `target` over `duration` ms.
 * Under reduced motion (or before mount) it returns the target instantly.
 */
export function useCountUp(
  target: number,
  duration = 600,
  initial?: number,
): number {
  const reduced = useReducedMotion();
  const startValue = initial ?? target;
  const [value, setValue] = useState(startValue);
  const fromRef = useRef(startValue);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    if (from === target) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, duration, reduced]);

  return value;
}
