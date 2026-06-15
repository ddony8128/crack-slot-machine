import { describe, it, expect } from 'vitest';
import { initialBoardFor } from '@/lib/board/initialBoard';
import { BASE_WEIGHTS } from '@/data/symbols';
import type { SymbolType } from '@/types';

describe('initialBoardFor', () => {
  it('is deterministic for the same seed + weights', () => {
    const a = initialBoardFor('run-abc', BASE_WEIGHTS);
    const b = initialBoardFor('run-abc', BASE_WEIGHTS);
    expect(a).toEqual(b);
  });

  it('returns n cells, all from positive-weight symbols', () => {
    const board = initialBoardFor('seed-1', BASE_WEIGHTS);
    expect(board).toHaveLength(5);
    const allowed = new Set(
      (Object.entries(BASE_WEIGHTS) as [SymbolType, number][])
        .filter(([, w]) => w > 0)
        .map(([s]) => s),
    );
    for (const cell of board) expect(allowed.has(cell)).toBe(true);
  });

  it('honors a custom n', () => {
    expect(initialBoardFor('seed-1', BASE_WEIGHTS, 3)).toHaveLength(3);
  });

  it('different seeds generally differ; the :initial-board suffix is namespaced', () => {
    // Across several seeds at least two boards should differ (not all identical).
    const boards = ['a', 'b', 'c', 'd', 'e'].map((s) =>
      initialBoardFor(s, BASE_WEIGHTS).join(','),
    );
    expect(new Set(boards).size).toBeGreaterThan(1);
  });

  it('respects a restricted bag (zero weight never appears)', () => {
    const onlySeven: Record<SymbolType, number> = {
      cherry: 0, lemon: 0, grape: 0, diamond: 0, ruby: 0, sapphire: 0,
      seven: 1, zero: 0, four: 0,
      // Season 1 set symbols (weight 0, never rolled) — keep Record shape valid.
      cheese_cat: 0, tuxedo_cat: 0, calico_cat: 0,
      plane: 0, ship: 0, car: 0,
      dracula: 0, zombie: 0, ghost: 0,
    };
    expect(initialBoardFor('x', onlySeven)).toEqual([
      'seven', 'seven', 'seven', 'seven', 'seven',
    ]);
  });
});
