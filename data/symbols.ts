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
};

export const FRUITS: SymbolType[] = ['cherry', 'lemon', 'grape'];
export const GEMS: SymbolType[] = ['diamond', 'ruby', 'sapphire'];

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
};
