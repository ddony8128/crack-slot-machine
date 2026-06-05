import { create } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameState, Rule, SpinLog, SymbolType } from '@/types';
import { defaultRng, type Rng } from '@/lib/rng';
import { baseSpin, computeWeights } from '@/lib/spin';
import { applyRules } from '@/lib/applyRules';
import { scoreResult } from '@/lib/score';
import { detectSpecials } from '@/lib/specials';
import { RULES } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';

const MAX_SPINS = 7;
const SLOT_COUNT = 5;
const OFFER_COUNT = 3;
const ZERO_RESULT: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];

export type PlaceTarget = { type: 'slot'; index: number } | { type: 'bag' };
export type RuleLocation = { zone: 'slot'; index: number } | { zone: 'bag'; index: number };

export type GameActions = {
  setNickname: (name: string) => void;
  startGame: () => void;
  selectRule: (rule: Rule) => void;
  cancelSelection: () => void;
  placePending: (target: PlaceTarget) => void;
  moveRule: (from: RuleLocation, to: RuleLocation) => void;
  spin: () => void;
  next: () => void;
  reset: () => void;
};

export type GameStore = GameState & GameActions;

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
 * Offer 3 distinct rules (by id) that are NOT currently in a slot OR the bag.
 * Shuffles the allowed pool with the injected rng and takes the first 3.
 * With 30 rules this never starves a 3-card offer.
 */
function offerRules(rng: Rng, slots: Array<Rule | null>, bag: Rule[]): Rule[] {
  const usedIds = new Set<string>();
  for (const r of slots) if (r != null) usedIds.add(r.id);
  for (const r of bag) usedIds.add(r.id);
  const allowed = RULES.filter((r) => !usedIds.has(r.id));
  return shuffle(allowed, rng).slice(0, OFFER_COUNT);
}

function emptySlots(): Array<Rule | null> {
  return [null, null, null, null, null];
}

function freshState(nickname: string): GameState {
  return {
    nickname,
    spinIndex: 0,
    maxSpins: MAX_SPINS,
    totalScore: 0,
    nextMultiplier: 1,
    previousResult: [...ZERO_RESULT],
    currentResult: [...ZERO_RESULT],
    ruleSlots: emptySlots(),
    bag: [],
    offeredRules: [],
    pendingRule: null,
    extraRulePickCount: 0,
    spinLogs: [],
    status: 'start',
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
      const ruleSlots = emptySlots();
      const bag: Rule[] = [];
      set({
        spinIndex: 0,
        maxSpins: MAX_SPINS,
        totalScore: 0,
        nextMultiplier: 1,
        previousResult: [...ZERO_RESULT],
        currentResult: [...ZERO_RESULT],
        ruleSlots,
        bag,
        extraRulePickCount: 0,
        pendingRule: null,
        spinLogs: [],
        offeredRules: offerRules(rng, ruleSlots, bag),
        status: 'choosing-rule',
      });
    },

    selectRule: (rule: Rule) => {
      if (get().status !== 'choosing-rule') return;
      set({ pendingRule: rule, status: 'placing' });
    },

    cancelSelection: () => {
      if (get().status !== 'placing') return;
      set({ pendingRule: null, status: 'choosing-rule' });
    },

    placePending: (target: PlaceTarget) => {
      const { pendingRule, ruleSlots, bag } = get();
      if (pendingRule == null) return;

      if (target.type === 'bag') {
        set({
          bag: [...bag, pendingRule],
          pendingRule: null,
          status: 'ready-to-spin',
        });
        return;
      }

      const { index } = target;
      if (index < 0 || index >= SLOT_COUNT) return;

      const nextSlots = ruleSlots.slice();
      const displaced = nextSlots[index];
      nextSlots[index] = pendingRule;
      const nextBag = displaced != null ? [...bag, displaced] : [...bag];

      set({
        ruleSlots: nextSlots,
        bag: nextBag,
        pendingRule: null,
        status: 'ready-to-spin',
      });
    },

    moveRule: (from: RuleLocation, to: RuleLocation) => {
      const state = get();
      if (state.status !== 'ready-to-spin' && state.status !== 'placing') return;

      const slots = state.ruleSlots.slice();
      const bag = state.bag.slice();

      // slot <-> slot: swap
      if (from.zone === 'slot' && to.zone === 'slot') {
        if (from.index < 0 || from.index >= SLOT_COUNT) return;
        if (to.index < 0 || to.index >= SLOT_COUNT) return;
        const tmp = slots[from.index];
        slots[from.index] = slots[to.index];
        slots[to.index] = tmp;
        set({ ruleSlots: slots });
        return;
      }

      // slot -> bag: clear slot, insert into bag at index
      if (from.zone === 'slot' && to.zone === 'bag') {
        if (from.index < 0 || from.index >= SLOT_COUNT) return;
        const moving = slots[from.index];
        if (moving == null) return;
        slots[from.index] = null;
        const insertAt = Math.max(0, Math.min(to.index, bag.length));
        bag.splice(insertAt, 0, moving);
        set({ ruleSlots: slots, bag });
        return;
      }

      // bag -> slot: place; if slot occupied, occupant goes to bag
      if (from.zone === 'bag' && to.zone === 'slot') {
        if (from.index < 0 || from.index >= bag.length) return;
        if (to.index < 0 || to.index >= SLOT_COUNT) return;
        const [moving] = bag.splice(from.index, 1);
        if (moving == null) return;
        const occupant = slots[to.index];
        slots[to.index] = moving;
        if (occupant != null) bag.push(occupant);
        set({ ruleSlots: slots, bag });
        return;
      }

      // bag <-> bag: reorder
      if (from.zone === 'bag' && to.zone === 'bag') {
        if (from.index < 0 || from.index >= bag.length) return;
        const [moving] = bag.splice(from.index, 1);
        const insertAt = Math.max(0, Math.min(to.index, bag.length));
        bag.splice(insertAt, 0, moving);
        set({ bag });
        return;
      }
    },

    spin: () => {
      const state = get();
      if (state.status !== 'ready-to-spin') return;

      const { ruleSlots, previousResult, spinIndex } = state;

      const weights = computeWeights(ruleSlots, BASE_WEIGHTS);
      const base = baseSpin(weights, rng);
      const { finalResult, steps, locked } = applyRules(base, ruleSlots, {
        previousResult,
        weights,
        rng,
      });
      const score = scoreResult(finalResult, ruleSlots);
      const multiplier = state.nextMultiplier;
      const roundScore = score.baseRoundScore * multiplier;
      const specials = detectSpecials(finalResult);

      const log: SpinLog = {
        spinIndex,
        baseResult: base,
        steps,
        finalResult,
        hand: score.hand,
        handScore: score.handScore,
        sevenScore: score.sevenScore,
        bonusScore: score.bonusScore,
        penalty: score.penalty,
        baseRoundScore: score.baseRoundScore,
        multiplier,
        roundScore,
        zeroDraw: specials.zeroDraw,
        multiplierSet: specials.nextMultiplier,
        lockedCells: locked,
      };

      set({
        totalScore: state.totalScore + roundScore,
        spinLogs: [...state.spinLogs, log],
        currentResult: finalResult,
        previousResult: finalResult,
        nextMultiplier: specials.nextMultiplier,
        extraRulePickCount: state.extraRulePickCount + (specials.zeroDraw ? 1 : 0),
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
          offeredRules: offerRules(rng, state.ruleSlots, state.bag),
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
        offeredRules: offerRules(rng, state.ruleSlots, state.bag),
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
