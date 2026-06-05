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

export const BASE_WEIGHTS: Record<SymbolType, number> = {
  cherry: 10,
  lemon: 10,
  grape: 10,
  diamond: 8,
  ruby: 8,
  sapphire: 8,
  seven: 4,
  zero: 18,
  four: 14,
};
