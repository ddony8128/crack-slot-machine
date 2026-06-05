"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Animates a number from its current displayed value to `target` over
 * `duration` ms. Pass `initial` to start from a fixed value (e.g. 0) on first
 * render; otherwise it starts already at `target`.
 *
 * Animation always resumes from the CURRENTLY displayed value (tracked via
 * valueRef), which makes it safe under React StrictMode's double-invoked
 * effects in dev — re-running the effect just continues toward the target
 * instead of getting stuck. Under reduced motion it jumps to the target.
 */
export function useCountUp(
  target: number,
  duration = 600,
  initial?: number,
): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(initial ?? target);
  const valueRef = useRef(initial ?? target);
  const rafRef = useRef<number | null>(null);

  // Track the latest committed value (outside render) so a re-run of the
  // animation effect resumes from what's currently on screen.
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(target);
      return;
    }

    const from = valueRef.current;
    if (from === target) return;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, reduced]);

  return value;
}
