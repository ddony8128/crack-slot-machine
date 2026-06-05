import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameState, Rule, SpinLog, SymbolType } from '@/types';
import { defaultRng, type Rng } from '@/lib/rng';
import { baseSpin, computeWeights } from '@/lib/spin';
import { applyRules } from '@/lib/applyRules';
import { scoreResult } from '@/lib/score';
import { isRuleDraw } from '@/lib/ruleDraw';
import { RULES } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';

const RULE_DRAW_BONUS = 150;
const MAX_SPINS = 5;
const ZERO_RESULT: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

export type GameActions = {
  setNickname: (name: string) => void;
  startGame: () => void;
  selectRule: (rule: Rule) => void;
  cancelSelection: () => void;
  equipToSlot: (slotIndex: 0 | 1 | 2) => void;
  spin: () => void;
  next: () => void;
  reset: () => void;
};

export type GameStore = GameState & {
  pendingRule: Rule | null;
} & GameActions;

/**
 * Fisher-Yates shuffle driven by the injected rng (not Math.random).
 * Returns a new array; does not mutate the input.
 */
function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const k = Math.min(j, i); // safety: rng() could theoretically return ~1
    [out[i], out[k]] = [out[k], out[i]];
  }
  return out;
}

/**
 * Pick up to 4 distinct rules (by id) that are NOT currently equipped in any
 * ruleSlot. Shuffle the allowed pool with the injected rng and take the first 4.
 */
function offerRules(rng: Rng, equipped: Array<Rule | null>): Rule[] {
  const equippedIds = new Set(
    equipped.filter((r): r is Rule => r != null).map((r) => r.id),
  );
  const allowed = RULES.filter((r) => !equippedIds.has(r.id));
  return shuffle(allowed, rng).slice(0, 4);
}

function freshState(nickname: string): GameState & { pendingRule: Rule | null } {
  return {
    nickname,
    spinIndex: 0,
    maxSpins: MAX_SPINS,
    totalScore: 0,
    previousResult: [...ZERO_RESULT],
    currentResult: [...ZERO_RESULT],
    ruleSlots: [null, null, null],
    offeredRules: [],
    extraRulePickCount: 0,
    spinLogs: [],
    status: 'start',
    pendingRule: null,
  };
}

type Initializer = (
  set: StoreApi<GameStore>['setState'],
  get: StoreApi<GameStore>['getState'],
) => GameStore;

function buildInitializer(rng: Rng): Initializer {
  return (set, get) => ({
    ...freshState(''),

    setNickname: (name: string) => set({ nickname: name }),

    startGame: () => {
      const { nickname } = get();
      if (!nickname || nickname.trim().length === 0) return;
      const ruleSlots: Array<Rule | null> = [null, null, null];
      set({
        spinIndex: 0,
        totalScore: 0,
        maxSpins: MAX_SPINS,
        previousResult: [...ZERO_RESULT],
        currentResult: [...ZERO_RESULT],
        ruleSlots,
        spinLogs: [],
        extraRulePickCount: 0,
        pendingRule: null,
        offeredRules: offerRules(rng, ruleSlots),
        status: 'choosing-rule',
      });
    },

    selectRule: (rule: Rule) => {
      if (get().status !== 'choosing-rule') return;
      set({ pendingRule: rule, status: 'choosing-slot' });
    },

    cancelSelection: () => {
      if (get().status !== 'choosing-slot') return;
      set({ pendingRule: null, status: 'choosing-rule' });
    },

    equipToSlot: (slotIndex: 0 | 1 | 2) => {
      const { pendingRule, ruleSlots } = get();
      if (pendingRule == null) return;
      const nextSlots = ruleSlots.slice();
      nextSlots[slotIndex] = pendingRule;
      set({ ruleSlots: nextSlots, pendingRule: null, status: 'ready-to-spin' });
    },

    spin: () => {
      const state = get();
      if (state.status !== 'ready-to-spin') return;

      const { ruleSlots, previousResult, spinIndex, maxSpins } = state;

      const weights = computeWeights(ruleSlots, BASE_WEIGHTS);
      const base = baseSpin(weights, rng);
      const { finalResult, steps } = applyRules(base, ruleSlots, {
        previousResult,
        weights,
        rng,
      });
      const { hand, handScore, penalty, roundScore } = scoreResult(finalResult);
      const ruleDraw = isRuleDraw(finalResult);

      const isLastSpin = spinIndex === maxSpins - 1;

      let finalRoundScore = roundScore;
      let extraRulePickCount = state.extraRulePickCount;

      if (ruleDraw && isLastSpin) {
        // RULE DRAW on the final spin pays out a flat bonus instead of an extra pick.
        finalRoundScore = roundScore + RULE_DRAW_BONUS;
      } else if (ruleDraw && !isLastSpin) {
        // RULE DRAW mid-game grants an extra rule pick (no points).
        extraRulePickCount += 1;
      }

      const log: SpinLog = {
        spinIndex,
        baseResult: base,
        steps,
        finalResult,
        hand,
        handScore,
        penalty,
        roundScore: finalRoundScore,
        ruleDraw,
      };

      set({
        totalScore: state.totalScore + finalRoundScore,
        spinLogs: [...state.spinLogs, log],
        currentResult: finalResult,
        previousResult: finalResult,
        extraRulePickCount,
        status: 'spin-result',
      });
    },

    next: () => {
      const state = get();
      if (state.status !== 'spin-result') return;

      if (state.extraRulePickCount > 0) {
        // Extra rule pick is consumed BEFORE advancing the spin counter.
        set({
          extraRulePickCount: state.extraRulePickCount - 1,
          offeredRules: offerRules(rng, state.ruleSlots),
          pendingRule: null,
          status: 'choosing-rule',
        });
        return;
      }

      const nextSpinIndex = state.spinIndex + 1;
      if (nextSpinIndex >= state.maxSpins) {
        set({ spinIndex: nextSpinIndex, status: 'finished' });
        return;
      }
      set({
        spinIndex: nextSpinIndex,
        offeredRules: offerRules(rng, state.ruleSlots),
        pendingRule: null,
        status: 'choosing-rule',
      });
    },

    reset: () => {
      const { nickname } = get();
      set({ ...freshState(nickname) });
    },
  });
}

/**
 * Factory so tests can inject a deterministic rng. Returns a zustand vanilla store.
 */
export function createGameStore(rng: Rng = defaultRng): StoreApi<GameStore> {
  return createStore<GameStore>(buildInitializer(rng));
}

/** Default React hook bound to the real (Math.random-backed) rng. */
export const useGameStore = create<GameStore>(buildInitializer(defaultRng));
