"use client";

import { useEffect, useRef, useState } from "react";
import type { SpinLog, SymbolType } from "@/types";
import { SYMBOL_EMOJI } from "@/data/symbols";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const REEL_SYMBOLS = Object.keys(SYMBOL_EMOJI) as SymbolType[];

// Timing (ms)
const ROLL_DURATION = 800; // total roll before reels begin to stop
const REEL_STAGGER = 110; // extra delay per reel as they stop left->right
const STEP_INTERVAL = 620; // gap between each rule-step reveal
const SETTLE_AFTER_FINAL = 360; // pause after final result before showing score

export type SpinRevealState = {
  /** Symbols currently shown on the reels. */
  symbols: SymbolType[];
  /** True while reels are rapidly cycling. */
  rolling: boolean;
  /** Per-reel rolling flags (reels stop left->right). */
  reelRolling: boolean[];
  /** Cells that should flash (just rewritten by the active step). */
  flashIndices: number[];
  /** Cells that just landed (pop-in). */
  landIndices: number[];
  /** Floating label of the rule step currently being applied, or null. */
  stepLabel: string | null;
  /** Cells frozen by a lock rule so far (rendered greyed-out). */
  lockedIndices: number[];
  /** True from the moment a spin starts until the score is revealed. */
  revealing: boolean;
  /** True once the reveal finished and the score should be shown. */
  scoreReady: boolean;
};

function randomReels(len: number): SymbolType[] {
  return Array.from(
    { length: len },
    () => REEL_SYMBOLS[Math.floor(Math.random() * REEL_SYMBOLS.length)],
  );
}

function diffIndices(a: SymbolType[], b: SymbolType[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) out.push(i);
  }
  return out;
}

function trueIndices(b?: boolean[]): number[] {
  if (!b) return [];
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (b[i]) out.push(i);
  return out;
}

/**
 * Drives the UI-only reveal sequence for the latest spin.
 *
 * Watches spinLogs.length; when a new log appears it plays:
 *   rolling -> land on baseResult -> apply each step -> finalResult -> score.
 *
 * The store stays pure: this hook owns all timers and the displayed symbol
 * array. When idle it falls back to `idleResult` (the store's currentResult).
 *
 * Under prefers-reduced-motion the whole sequence collapses to an instant
 * jump to the final result with the score immediately ready.
 */
export function useSpinReveal(
  latestLog: SpinLog | null,
  idleResult: SymbolType[],
): SpinRevealState {
  const reduced = useReducedMotion();

  const [symbols, setSymbols] = useState<SymbolType[]>(idleResult);
  const [rolling, setRolling] = useState(false);
  const [reelRolling, setReelRolling] = useState<boolean[]>([]);
  const [flashIndices, setFlashIndices] = useState<number[]>([]);
  const [landIndices, setLandIndices] = useState<number[]>([]);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [lockedIndices, setLockedIndices] = useState<number[]>([]);
  const [revealing, setRevealing] = useState(false);
  const [scoreReady, setScoreReady] = useState(false);

  // Track the last log we revealed by OBJECT IDENTITY (a fresh log object is
  // pushed every spin). spinIndex is NOT unique — it repeats after an extra
  // rule pick (zeros>=3), which previously made the reveal skip those spins.
  const seenLogRef = useRef<SpinLog | null>(latestLog);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep idle display in sync with the store when not revealing.
  useEffect(() => {
    if (!revealing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSymbols(idleResult);
      setLockedIndices(trueIndices(latestLog?.lockedCells));
    }
    // idleResult identity changes each spin via the store.
  }, [idleResult, revealing, latestLog]);

  useEffect(() => {
    if (!latestLog) return;
    // Only react to a genuinely new spin log (by object identity).
    if (latestLog === seenLogRef.current) return;
    seenLogRef.current = latestLog;

    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (rollInterval.current) {
        clearInterval(rollInterval.current);
        rollInterval.current = null;
      }
    };
    const at = (ms: number, fn: () => void) => {
      timers.current.push(setTimeout(fn, ms));
    };

    clearAll();

    const len = latestLog.baseResult.length;
    // Locked (held) cells are known up-front: they never spin and stay frozen
    // at their held value (baseResult[i] == previousResult[i]) for the whole reveal.
    const lockedSet = new Set(trueIndices(latestLog.lockedCells));

    // Interactive spins (a `select` rule resolved with player clicks) were
    // already watched live during 'awaiting-selection', so skip playback and
    // jump straight to the final board + score, same as reduced-motion.
    if (reduced || latestLog.interactive) {
      // Instant: jump straight to the final result + score.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRolling(false);
      setReelRolling(Array(len).fill(false));
      setFlashIndices([]);
      setLandIndices([]);
      setStepLabel(null);
      setLockedIndices(trueIndices(latestLog.lockedCells));
      setSymbols(latestLog.finalResult);
      setRevealing(false);
      setScoreReady(true);
      return clearAll;
    }

    // --- Phase 1: rolling (locked cells do NOT roll) ---
    setScoreReady(false);
    setRevealing(true);
    setRolling(true);
    // Locked cells are not rolling from the very start.
    setReelRolling(Array.from({ length: len }, (_, i) => !lockedSet.has(i)));
    setFlashIndices([]);
    setLandIndices([]);
    setStepLabel(null);
    // Locked cells are shown frozen from the start of the reveal.
    setLockedIndices(trueIndices(latestLog.lockedCells));
    // Seed display: locked cells already at their held value, others arbitrary.
    setSymbols(latestLog.baseResult.slice());

    rollInterval.current = setInterval(() => {
      // Only randomize NON-locked cells; held cells keep their value.
      setSymbols(() =>
        randomReels(len).map((s, i) =>
          lockedSet.has(i) ? latestLog.baseResult[i] : s,
        ),
      );
    }, 70);

    // --- Phase 2: stop left -> right, landing on baseResult (skip locked cells) ---
    for (let i = 0; i < len; i++) {
      if (lockedSet.has(i)) continue; // held cells already show their value
      at(ROLL_DURATION + i * REEL_STAGGER, () => {
        setSymbols((prev) => {
          const next = prev.slice();
          next[i] = latestLog.baseResult[i];
          return next;
        });
        setReelRolling((prev) => {
          const next = prev.slice();
          next[i] = false;
          return next;
        });
        setLandIndices((prev) => [...prev, i]);
        // clear this cell's land flag shortly after so it can re-pop later
        at(360, () => setLandIndices((prev) => prev.filter((x) => x !== i)));
      });
    }

    const allLanded = ROLL_DURATION + (len - 1) * REEL_STAGGER + 60;
    at(allLanded, () => {
      setRolling(false);
      if (rollInterval.current) clearInterval(rollInterval.current);
      rollInterval.current = null;
    });

    // --- Phase 3: sequential rule steps ---
    const steps = latestLog.steps;
    let cursor = allLanded + 220;
    let prevResult = latestLog.baseResult;

    steps.forEach((step) => {
      const changed = diffIndices(prevResult, step.result);
      const resultSnapshot = step.result;
      const labelSnapshot = step.label;
      const lockedSnapshot = trueIndices(step.locked);
      at(cursor, () => {
        setStepLabel(labelSnapshot);
        setSymbols(resultSnapshot.slice());
        setFlashIndices(changed);
        setLockedIndices(lockedSnapshot);
        at(STEP_INTERVAL - 80, () => {
          setFlashIndices([]);
          setStepLabel(null);
        });
      });
      prevResult = step.result;
      cursor += STEP_INTERVAL;
    });

    // --- Phase 4: ensure final result, then reveal score ---
    at(cursor, () => {
      setSymbols(latestLog.finalResult.slice());
      setStepLabel(null);
      setFlashIndices([]);
      setLockedIndices(trueIndices(latestLog.lockedCells));
    });
    at(cursor + SETTLE_AFTER_FINAL, () => {
      setRevealing(false);
      setScoreReady(true);
    });

    return clearAll;
  }, [latestLog, reduced]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      if (rollInterval.current) clearInterval(rollInterval.current);
    };
  }, []);

  return {
    symbols,
    rolling,
    reelRolling,
    flashIndices,
    landIndices,
    stepLabel,
    lockedIndices,
    revealing,
    scoreReady,
  };
}
