import type { AchievementKey, SymbolType } from '@/types';
import { ACHIEVEMENT_KEYS } from '@/types';

/**
 * Pure achievement detection (no I/O). Shared by the server replay verifier
 * (authoritative, cheat-proof) and the client live UI. A board is one spin's
 * final 5 cells. Internal symbol ids are unchanged in the BLACKHAVEN reskin
 * (cherry/lemon/grape display as 손/발/눈; diamond/ruby/sapphire as 좀비/흡혈귀/유령),
 * so detection keys off the original ids.
 */

const BODY: SymbolType[] = ['cherry', 'lemon', 'grape'];
const MONSTER: SymbolType[] = ['diamond', 'ruby', 'sapphire'];

function hasAll(board: SymbolType[], needed: SymbolType[]): boolean {
  return needed.every((s) => board.includes(s));
}

function countOf(board: SymbolType[], s: SymbolType): number {
  return board.reduce((n, c) => (c === s ? n + 1 : n), 0);
}

/** Achievements satisfied by a SINGLE spin's final board. */
export function detectBoardAchievements(board: SymbolType[]): AchievementKey[] {
  const out: AchievementKey[] = [];
  if (hasAll(board, BODY)) out.push('frankenstein');
  if (hasAll(board, MONSTER)) out.push('hyakki');
  if (countOf(board, 'seven') === 5) out.push('midas');
  if (countOf(board, 'four') === 5) out.push('familiar_death');
  return out;
}

/** Union of achievements across every spin's final board in a run. */
export function detectRunAchievements(boards: SymbolType[][]): AchievementKey[] {
  const set = new Set<AchievementKey>();
  for (const board of boards) {
    for (const key of detectBoardAchievements(board)) set.add(key);
  }
  // Stable order matching ACHIEVEMENT_KEYS.
  return ACHIEVEMENT_KEYS.filter((k) => set.has(k));
}

/** True once `unlocked` covers every achievement. */
export function hasAllAchievements(unlocked: Iterable<AchievementKey>): boolean {
  const set = new Set(unlocked);
  return ACHIEVEMENT_KEYS.every((k) => set.has(k));
}
