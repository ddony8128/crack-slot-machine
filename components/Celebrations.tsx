"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CONFETTI_COLORS = [
  "#f5c518",
  "#fcd34d",
  "#34d399",
  "#10b981",
  "#fbbf24",
  "#f59e0b",
  "#a7f3d0",
];

type ConfettiPiece = {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
};

function makePieces(): ConfettiPiece[] {
  return Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.6 + Math.random() * 1.4,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: Math.random() * 360,
  }));
}

function Confetti() {
  // Generated after mount so the impure RNG never runs during render.
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPieces(makePieces());
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen celebratory overlays. Rendered only briefly when a JACKPOT or
 * RULE DRAW occurs. Under reduced motion, shows a static centered callout
 * (no confetti, no large movement, no screen pulse).
 */
export function JackpotCelebration() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {!reduced && (
        <>
          <div className="jackpot-glow absolute inset-0" />
          <Confetti />
        </>
      )}
      <div
        className={`${
          reduced ? "" : "celebrate-pop"
        } select-none text-center`}
      >
        <p className="text-6xl font-black tracking-tight text-amber-300 drop-shadow-[0_0_25px_rgba(245,197,24,0.8)] sm:text-8xl">
          JACKPOT!
        </p>
        <p className="mt-2 text-lg font-bold text-amber-200 sm:text-2xl">
          777 7 7
        </p>
      </div>
    </div>
  );
}

export function ExtraRuleCelebration() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {!reduced && (
        <div className="ruledraw-flash absolute inset-0 bg-emerald-500/25" />
      )}
      <div
        className={`${
          reduced ? "" : "celebrate-pop"
        } select-none text-center`}
      >
        <p className="text-5xl font-black tracking-tight text-emerald-300 drop-shadow-[0_0_22px_rgba(16,185,129,0.8)] sm:text-7xl">
          추가 규칙!
        </p>
      </div>
    </div>
  );
}

export function MultiplierCelebration({ multiplier }: { multiplier: number }) {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      {!reduced && (
        <div className="jackpot-glow absolute inset-0" />
      )}
      <div
        className={`${reduced ? "" : "celebrate-pop"} select-none text-center`}
      >
        <p className="text-6xl font-black tracking-tight text-amber-300 drop-shadow-[0_0_25px_rgba(245,197,24,0.8)] sm:text-8xl">
          ×{multiplier} 배수!
        </p>
        <p className="mt-2 text-lg font-bold text-amber-200 sm:text-2xl">
          다음 스핀 점수 배수 적용
        </p>
      </div>
    </div>
  );
}
