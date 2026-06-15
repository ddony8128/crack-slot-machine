import type { SymbolType } from '@/types';

export const SYMBOL_EMOJI: Record<SymbolType, string> = {
  cherry: '🍒',
  lemon: '🍋',
  grape: '🍇',
  diamond: '💎',
  ruby: '🔴',
  sapphire: '🔵',
  seven: '7',
  zero: '0',
  four: '4',
  // Season 1 sets (emoji sourced from SYMBOL_SETS in lib/symbols/sets.ts).
  cheese_cat: '🐱',
  tuxedo_cat: '🐈‍⬛',
  calico_cat: '😺',
  plane: '✈️',
  ship: '🚢',
  car: '🚗',
  dracula: '🧛',
  zombie: '🧟',
  ghost: '👻',
  // hybrid: scores as both a cat and a monster (see lib/symbols/tags.ts).
  zombie_cat: '😼',
};

export const FRUITS: SymbolType[] = ['cherry', 'lemon', 'grape'];
export const GEMS: SymbolType[] = ['diamond', 'ruby', 'sapphire'];

// Season 1 sets, mirroring FRUITS/GEMS shape. Source of truth: SYMBOL_SETS
// (lib/symbols/sets.ts). These ids default to weight 0 in BASE_WEIGHTS.
export const CATS: SymbolType[] = ['cheese_cat', 'tuxedo_cat', 'calico_cat'];
export const VEHICLES: SymbolType[] = ['plane', 'ship', 'car'];
export const MONSTERS: SymbolType[] = ['dracula', 'zombie', 'ghost'];
export const NUMBERS: SymbolType[] = ['zero', 'four', 'seven'];

// RED set = {ruby, cherry}. BLUE set = {sapphire, grape}.
export const RED: SymbolType[] = ['ruby', 'cherry'];
export const BLUE: SymbolType[] = ['sapphire', 'grape'];
export const RED_SET = new Set<SymbolType>(RED);
export const BLUE_SET = new Set<SymbolType>(BLUE);

// Base weights are UNIFORM: every symbol weight = 1.
export const BASE_WEIGHTS: Record<SymbolType, number> = {
  cherry: 1,
  lemon: 1,
  grape: 1,
  diamond: 1,
  ruby: 1,
  sapphire: 1,
  seven: 1,
  zero: 1,
  four: 1,
  // Season 1 set symbols default to weight 0: legacy/quick/event modes never
  // roll them. They only appear when a specific mode's bag explicitly includes
  // (re-weights) them. Keeping them here satisfies the Record<SymbolType> shape.
  cheese_cat: 0,
  tuxedo_cat: 0,
  calico_cat: 0,
  plane: 0,
  ship: 0,
  car: 0,
  dracula: 0,
  zombie: 0,
  ghost: 0,
  // hybrid: weight 0, never rolled. Only created by the monster-infect rule.
  zombie_cat: 0,
};
