import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import { rollBoard } from '@/lib/spin';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { rulePlayable } from '@/lib/rules/playable';
import { SYMBOL_SETS_BY_ID } from '@/lib/symbols/sets';
import { createSeededRng } from '@/lib/rng';
import { POSITIONAL_WEIGHT_RULES } from '@/lib/rules/positionalWeights';

const CAT_ODDS = RULES_BY_ID['cat-odds'];
const NIGHT_PARADE = RULES_BY_ID['night-parade'];

// A full SymbolType weight record, all 0 except the given overrides. Key order
// follows BASE_WEIGHTS (lemon before cheese_cat before dracula), which the
// cumulative draw in rollSymbol depends on.
function bag(overrides: Partial<Record<SymbolType, number>>): Record<SymbolType, number> {
  const zeroed = { ...BASE_WEIGHTS };
  for (const k of Object.keys(zeroed) as SymbolType[]) zeroed[k] = 0;
  return { ...zeroed, ...overrides };
}

// Constant rng — lets us reason about the exact landing symbol per cell.
const fixed = (v: number) => () => v;

describe('cat-odds (고양이 확률 증가) — odd-cell ×4 cat boost', () => {
  // cheese_cat:1, lemon:3. Even cell: total 4, r*4=2 < 3 → lemon. Odd cell with
  // ×4 cat: cheese_cat 4 / lemon 3, total 7, r*7=3.5 → after lemon(-3)=0.5 →
  // cheese_cat. So r=0.5 lands cats only on the odd (1-indexed) cells.
  const w = bag({ cheese_cat: 1, lemon: 3 });
  const prev: SymbolType[] = ['lemon', 'lemon', 'lemon', 'lemon', 'lemon'];

  it('boosts cats on indices 0/2/4 only', () => {
    const board = rollBoard([CAT_ODDS], w, prev, fixed(0.5), 5);
    expect(board).toEqual(['cheese_cat', 'lemon', 'cheese_cat', 'lemon', 'cheese_cat']);
  });

  it('without the rule the same draw lands all lemon (no boost)', () => {
    const board = rollBoard([], w, prev, fixed(0.5), 5);
    expect(board).toEqual(['lemon', 'lemon', 'lemon', 'lemon', 'lemon']);
  });
});

describe('night-parade (백귀야행) — monster ×(prev monsters + 3)', () => {
  // dracula:1, lemon:3. r=0.5.
  const w = bag({ dracula: 1, lemon: 3 });

  it('with 2 previous-spin monsters (×5) every cell lands dracula', () => {
    const prev: SymbolType[] = ['dracula', 'zombie', 'lemon', 'lemon', 'lemon'];
    const board = rollBoard([NIGHT_PARADE], w, prev, fixed(0.5), 5);
    expect(board).toEqual(['dracula', 'dracula', 'dracula', 'dracula', 'dracula']);
  });

  it('even with 0 previous monsters the +3 base still boosts (×3 → dracula)', () => {
    const prev: SymbolType[] = ['lemon', 'lemon', 'lemon', 'lemon', 'lemon'];
    const board = rollBoard([NIGHT_PARADE], w, prev, fixed(0.5), 5);
    expect(board).toEqual(['dracula', 'dracula', 'dracula', 'dracula', 'dracula']);
  });

  it('without the rule the same draw lands all lemon', () => {
    const prev: SymbolType[] = ['dracula', 'zombie', 'lemon', 'lemon', 'lemon'];
    const board = rollBoard([], w, prev, fixed(0.5), 5);
    expect(board).toEqual(['lemon', 'lemon', 'lemon', 'lemon', 'lemon']);
  });
});

describe('replay determinism — no-op in legacy bags (cat/monster weight 0)', () => {
  it('cat-odds + night-parade leave a 0-weight bag byte-identical', () => {
    const prev: SymbolType[] = ['cherry', 'cherry', 'cherry', 'cherry', 'cherry'];
    const withRules = rollBoard(
      [CAT_ODDS, NIGHT_PARADE],
      BASE_WEIGHTS,
      prev,
      createSeededRng('wave4'),
      5,
    );
    const without = rollBoard([], BASE_WEIGHTS, prev, createSeededRng('wave4'), 5);
    expect(withRules).toEqual(without);
  });
});

describe('rulePlayable + set wiring', () => {
  it('cat-odds is only offered when cats can roll', () => {
    expect(rulePlayable(CAT_ODDS, BASE_WEIGHTS)).toBe(false);
    expect(rulePlayable(CAT_ODDS, { ...BASE_WEIGHTS, cheese_cat: 1 })).toBe(true);
  });

  it('night-parade is only offered when monsters can roll', () => {
    expect(rulePlayable(NIGHT_PARADE, BASE_WEIGHTS)).toBe(false);
    expect(rulePlayable(NIGHT_PARADE, { ...BASE_WEIGHTS, dracula: 1 })).toBe(true);
  });

  it('belong to the cat / monster sets', () => {
    expect(SYMBOL_SETS_BY_ID.cat.ruleIds).toContain('cat-odds');
    expect(SYMBOL_SETS_BY_ID.monster.ruleIds).toContain('night-parade');
  });

  it('are registered as positional-weight transforms (single source of truth)', () => {
    expect(Object.keys(POSITIONAL_WEIGHT_RULES).sort()).toEqual(['cat-odds', 'night-parade']);
  });
});
