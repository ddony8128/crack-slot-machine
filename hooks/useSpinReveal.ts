"use client";

import { useEffect, useRef, useState } from "react";
import type { RevealStream, SymbolType } from "@/types";
import { SYMBOL_EMOJI } from "@/data/symbols";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const REEL_SYMBOLS = Object.keys(SYMBOL_EMOJI) as SymbolType[];

// Timing (ms)
const ROLL_DURATION = 800; // total roll before reels begin to stop
const REEL_STAGGER = 110; // extra delay per reel as they stop left->right
const STEP_INTERVAL = 1500; // gap between each rule-step reveal (slower = clearer)
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
  /**
   * True when the step animation has caught up to a pending `select` rule and
   * the spin is paused waiting for the player to pick. The picker should only
   * show once this is true (until then the stage shows the step animation).
   */
  readyForPick: boolean;
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
 * Drives the UI-only reveal sequence, consuming the store's incremental
 * `revealStream`. The reveal plays exactly ONCE per spin:
 *
 *   roll → land on baseResult → animate each step → (pause at a `select`) →
 *   continue with the new steps → settle on final → score.
 *
 * State machine:
 *  - A NEW `stream.id` means a brand-new spin: reset, play the roll phase, then
 *    animate every step that has arrived so far.
 *  - The SAME `stream.id` gaining more steps (after `selectCells`) continues
 *    animating the appended steps from where it left off — NO re-roll, NO
 *    replay.
 *  - When the animation catches up to all currently-known steps:
 *      • if `stream.done` → score is revealed.
 *      • else → a `select` rule is waiting: pause and raise `readyForPick`.
 *
 * The store stays pure: this hook owns all timers and the displayed symbol
 * array. When `stream` is null (idle) it shows `idleResult`.
 *
 * Under prefers-reduced-motion the sequence collapses to an instant jump to the
 * latest known result; the picker appears immediately when input is awaited.
 */
export function useSpinReveal(
  stream: RevealStream | null,
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
  const [readyForPick, setReadyForPick] = useState(false);
  const [scoreReady, setScoreReady] = useState(false);

  // Reveal-machine bookkeeping. `lastId` is the stream id we're currently
  // animating; `shownSteps` counts how many steps have already been animated for
  // that id (so appended steps continue rather than replay).
  const lastIdRef = useRef<number | null>(null);
  const shownStepsRef = useRef(0);
  // The board snapshot of the last animated step (or baseResult), used to
  // compute the flash diff for the next step.
  const prevResultRef = useRef<SymbolType[]>(idleResult);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep idle display in sync with the store when no stream is active.
  useEffect(() => {
    if (stream == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSymbols(idleResult);
      setLockedIndices([]);
      setRevealing(false);
      setReadyForPick(false);
      setScoreReady(false);
      setRolling(false);
      setReelRolling([]);
      setFlashIndices([]);
      setLandIndices([]);
      setStepLabel(null);
      lastIdRef.current = null;
      shownStepsRef.current = 0;
    }
  }, [stream, idleResult]);

  useEffect(() => {
    if (stream == null) return;

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

    const len = stream.baseResult.length;
    const isNewSpin = stream.id !== lastIdRef.current;

    /**
     * Animate steps[from .. end] STEP_INTERVAL apart, starting at `startAt`ms.
     * Returns the time (ms) at which the last step finishes. Updates the refs
     * (shownSteps / prevResult) as each step fires.
     */
    const animateSteps = (from: number, startAt: number): number => {
      const steps = stream.steps;
      let cursor = startAt;
      let prev = prevResultRef.current;
      for (let s = from; s < steps.length; s++) {
        const step = steps[s];
        const valueChanged = diffIndices(prev, step.result);
        // A reroll that lands on the SAME value changes nothing in the diff, yet
        // the cell DID spin — flash those cells too so the reroll is visible.
        const changed = step.rerolled?.length
          ? Array.from(new Set([...valueChanged, ...step.rerolled]))
          : valueChanged;
        const resultSnapshot = step.result;
        const labelSnapshot = step.label;
        const lockedSnapshot = trueIndices(step.locked);
        const stepCount = s + 1;
        at(cursor, () => {
          setStepLabel(labelSnapshot);
          setSymbols(resultSnapshot.slice());
          setFlashIndices(changed);
          setLockedIndices(lockedSnapshot);
          shownStepsRef.current = stepCount;
          prevResultRef.current = resultSnapshot;
          at(STEP_INTERVAL - 80, () => {
            setFlashIndices([]);
            setStepLabel(null);
          });
        });
        prev = step.result;
        cursor += STEP_INTERVAL;
      }
      return cursor;
    };

    /**
     * After the steps known so far finish at `endAt`ms, decide what happens:
     *  - done → reveal the score.
     *  - else → a select rule is waiting → pause and raise readyForPick.
     */
    const settle = (endAt: number) => {
      if (stream.done) {
        // Ensure the final board is shown, then reveal score.
        const final = stream.steps.length
          ? stream.steps[stream.steps.length - 1].result
          : stream.baseResult;
        at(endAt, () => {
          setSymbols(final.slice());
          setStepLabel(null);
          setFlashIndices([]);
        });
        at(endAt + SETTLE_AFTER_FINAL, () => {
          setRevealing(false);
          setReadyForPick(false);
          setScoreReady(true);
        });
      } else {
        // Paused at a select rule: stop and wait for the player.
        at(endAt, () => {
          setRevealing(false);
          setReadyForPick(true);
          setStepLabel(null);
          setFlashIndices([]);
        });
      }
    };

    // ---- Reduced motion: collapse to an instant jump to the latest result. ----
    if (reduced) {
      clearAll();
      const final = stream.steps.length
        ? stream.steps[stream.steps.length - 1].result
        : stream.baseResult;
      const lockedNow = stream.steps.length
        ? trueIndices(stream.steps[stream.steps.length - 1].locked)
        : [];
      lastIdRef.current = stream.id;
      shownStepsRef.current = stream.steps.length;
      prevResultRef.current = final;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRolling(false);
      setReelRolling(Array(len).fill(false));
      setFlashIndices([]);
      setLandIndices([]);
      setStepLabel(null);
      setLockedIndices(lockedNow);
      setSymbols(final.slice());
      if (stream.done) {
        setRevealing(false);
        setReadyForPick(false);
        setScoreReady(true);
      } else {
        setRevealing(false);
        setReadyForPick(true);
        setScoreReady(false);
      }
      return clearAll;
    }

    if (!isNewSpin) {
      // ---- SAME spin, more steps arrived: continue, no roll, no replay. ----
      if (stream.steps.length <= shownStepsRef.current) {
        // No new steps to animate (e.g. only `done` flipped with no new step).
        // Re-evaluate settle from now.
        settle(0);
        return clearAll;
      }
      clearAll();
      setReadyForPick(false);
      setScoreReady(false);
      setRevealing(true);
      const endAt = animateSteps(shownStepsRef.current, 0);
      settle(endAt);
      return clearAll;
    }

    // ---- NEW spin: full roll phase, then animate all known steps. ----
    clearAll();
    lastIdRef.current = stream.id;
    shownStepsRef.current = 0;
    prevResultRef.current = stream.baseResult;

    // Locked (held) cells are known up-front: they never spin and stay frozen
    // at their held value (baseResult[i]) for the roll. We derive the held set
    // from the FIRST step's lock snapshot if present, else none roll-frozen.
    // (Pre-roll holds are the only locks affecting the baseResult; later lock
    // rules grey cells mid-stream.) We approximate held cells as those whose
    // baseResult value should not roll — taken from the first step that has any
    // locked flag, or empty if no step locks. To stay safe, derive from step 0.
    const firstLocked =
      stream.steps.length && stream.steps[0].locked
        ? stream.steps[0].locked
        : undefined;
    // Held-from-start cells: only those locked AND already at baseResult. Since
    // pre-roll holds set baseResult to the held value, locked cells from the
    // first lock snapshot that equal baseResult are the held ones. Simplest &
    // correct for the existing lock rules: treat all firstLocked cells as held.
    const lockedSet = new Set(trueIndices(firstLocked));

    setScoreReady(false);
    setReadyForPick(false);
    setRevealing(true);
    setRolling(true);
    setReelRolling(Array.from({ length: len }, (_, i) => !lockedSet.has(i)));
    setFlashIndices([]);
    setLandIndices([]);
    setStepLabel(null);
    setLockedIndices(trueIndices(firstLocked));
    setSymbols(stream.baseResult.slice());

    rollInterval.current = setInterval(() => {
      setSymbols(() =>
        randomReels(len).map((s, i) =>
          lockedSet.has(i) ? stream.baseResult[i] : s,
        ),
      );
    }, 70);

    // Stop reels left -> right, landing on baseResult (skip held cells).
    for (let i = 0; i < len; i++) {
      if (lockedSet.has(i)) continue;
      at(ROLL_DURATION + i * REEL_STAGGER, () => {
        setSymbols((prev) => {
          const next = prev.slice();
          next[i] = stream.baseResult[i];
          return next;
        });
        setReelRolling((prev) => {
          const next = prev.slice();
          next[i] = false;
          return next;
        });
        setLandIndices((prev) => [...prev, i]);
        at(360, () => setLandIndices((prev) => prev.filter((x) => x !== i)));
      });
    }

    const allLanded = ROLL_DURATION + (len - 1) * REEL_STAGGER + 60;
    at(allLanded, () => {
      setRolling(false);
      if (rollInterval.current) clearInterval(rollInterval.current);
      rollInterval.current = null;
      setSymbols(stream.baseResult.slice());
    });

    // Animate all steps known so far, then settle (done → score, else → pause).
    const stepsStart = allLanded + 220;
    const endAt = animateSteps(0, stepsStart);
    settle(endAt);

    return clearAll;
    // We intentionally depend on id + steps.length + done so the effect re-runs
    // when a new spin starts OR the same spin gains steps / completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id, stream?.steps.length, stream?.done, reduced]);

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
    readyForPick,
    scoreReady,
  };
}
