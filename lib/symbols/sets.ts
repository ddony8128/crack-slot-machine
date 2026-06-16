/**
 * Config-driven symbol-set definitions for RULE SLOT Season 1.
 *
 * Data + types only — NOT wired into the play engine yet. The engine still uses
 * the legacy fruit/gem symbols from `types/SymbolType`; these sets are
 * forward-ready for when extra symbol sets are wired in.
 *
 * Follow-ups (later WUs):
 *  - fruit/gem 확률 values here use ×3 (matching the existing FRUIT/GEM SURGE
 *    rules); the spec calls for ×4 — to be reconciled.
 *  - cat / vehicle / monster set-specific rules are not authored yet, so their
 *    ruleIds are empty. Bonuses for those sets are scored from set membership.
 *
 * INVARIANT: every id in `ruleIds` must exist in RULES_BY_ID (see data/rules.ts).
 */

export type SymbolDef = {
  id: string; // string (new symbols not yet in SymbolType)
  name: string;
  emoji: string;
};

export type SetBonus =
  | { type: 'all-types'; points: number } // all distinct types of this set present in the result
  | { type: 'all-symbols'; points: number } // all 5 cells are from this set
  | { type: 'per-symbol'; points: number } // per symbol of this set on the board
  | { type: 'adjacent-penalty'; points: number } // per adjacent same-set pair (points negative)
  | { type: 'per-event'; event: 'moved' | 'rerolled' | 'copied'; points: number };

export type SymbolSet = {
  id: string;
  name: string;
  symbols: SymbolDef[];
  isNumberSet?: boolean;
  bonuses: SetBonus[];
  ruleIds: string[];
};

export const SYMBOL_SETS: SymbolSet[] = [
  {
    id: 'number',
    name: '숫자',
    isNumberSet: true,
    symbols: [
      { id: 'zero', name: '0', emoji: '0' },
      { id: 'four', name: '4', emoji: '4' },
      { id: 'seven', name: '7', emoji: '7' },
    ],
    bonuses: [],
    ruleIds: [
      'seven-fever',
      'seven-double',
      'zero-to-seven',
      'four-shield',
      'four-parry',
      'four-fortune',
      'clean-bonus',
    ],
  },
  {
    id: 'fruit',
    name: '과일',
    symbols: [
      { id: 'cherry', name: '체리', emoji: '🍒' },
      { id: 'lemon', name: '레몬', emoji: '🍋' },
      { id: 'grape', name: '포도', emoji: '🍇' },
    ],
    bonuses: [
      { type: 'all-types', points: 50 },
      { type: 'all-symbols', points: 100 },
    ],
    ruleIds: ['fruit-surge', 'first-cherry', 'fruit-freeze', 'fruit-fish', 'fruit-vitamin'],
  },
  {
    id: 'gem',
    name: '보석',
    symbols: [
      { id: 'diamond', name: '다이아몬드', emoji: '💎' },
      { id: 'ruby', name: '루비', emoji: '🔴' },
      { id: 'sapphire', name: '사파이어', emoji: '🔵' },
    ],
    bonuses: [
      { type: 'all-types', points: 80 },
      { type: 'all-symbols', points: 150 },
    ],
    ruleIds: ['gem-surge', 'diamond-cut', 'gem-fish', 'gem-shuffle', 'gem-beauty'],
  },
  {
    id: 'cat',
    name: '고양이',
    symbols: [
      { id: 'cheese_cat', name: '치즈냥', emoji: '🐱' },
      { id: 'tuxedo_cat', name: '턱시도냥', emoji: '🐈‍⬛' },
      { id: 'calico_cat', name: '삼색냥', emoji: '😺' },
    ],
    bonuses: [
      { type: 'per-symbol', points: 30 },
      { type: 'adjacent-penalty', points: -60 },
      { type: 'all-types', points: 200 },
    ],
    ruleIds: ['cat-hold', 'cat-zoomies', 'cat-jump', 'cat-turf'],
  },
  {
    id: 'vehicle',
    name: '교통수단',
    symbols: [
      { id: 'plane', name: '비행기', emoji: '✈️' },
      { id: 'ship', name: '배', emoji: '🚢' },
      { id: 'car', name: '자동차', emoji: '🚗' },
    ],
    bonuses: [
      { type: 'per-event', event: 'moved', points: 20 },
      { type: 'per-event', event: 'rerolled', points: 20 },
    ],
    ruleIds: ['vehicle-parking', 'vehicle-surge', 'vehicle-logistics', 'vehicle-bigboat', 'vehicle-crash'],
  },
  {
    id: 'monster',
    name: '괴물',
    symbols: [
      { id: 'dracula', name: '드라큘라', emoji: '🧛' },
      { id: 'zombie', name: '좀비', emoji: '🧟' },
      { id: 'ghost', name: '유령', emoji: '👻' },
    ],
    bonuses: [{ type: 'per-event', event: 'copied', points: 40 }],
    ruleIds: ['monster-family', 'jibakryeong', 'plague'],
  },
];

export const SYMBOL_SETS_BY_ID: Record<string, SymbolSet> = Object.fromEntries(
  SYMBOL_SETS.map((set) => [set.id, set]),
);
