import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import type { PuzzleGoal } from '@/lib/puzzle/config';
import {
  handAtLeast,
  checkGoal,
  checkPuzzleRun,
  type GoalContext,
} from '@/lib/puzzle/goals';

function ctx(
  board: SymbolType[],
  hand = 'No Hand',
  spinScore = 0,
): GoalContext {
  return { board, hand, spinScore };
}

describe('handAtLeast', () => {
  it('respects the rank order No Hand < Pair < Two Pair < Triple < Full House < Four < Five', () => {
    const order = [
      'No Hand',
      'Pair',
      'Two Pair',
      'Triple',
      'Full House',
      'Four of a Kind',
      'Five of a Kind',
    ];
    for (let i = 0; i < order.length; i++) {
      // equal and everything below it satisfies; everything above does not
      for (let j = 0; j < order.length; j++) {
        expect(handAtLeast(order[i], order[j])).toBe(i >= j);
      }
    }
  });

  it('treats unknown actual hands as the floor', () => {
    expect(handAtLeast('Garbage', 'Pair')).toBe(false);
    expect(handAtLeast('Garbage', 'No Hand')).toBe(true);
  });
});

describe('checkGoal: contains_symbol_count', () => {
  const goal: PuzzleGoal = { type: 'contains_symbol_count', symbolId: 'seven', count: 3 };
  it('passes when count is met', () => {
    expect(checkGoal(goal, ctx(['seven', 'seven', 'seven', 'zero', 'four']))).toBe(true);
  });
  it('passes when count is exceeded', () => {
    expect(checkGoal(goal, ctx(['seven', 'seven', 'seven', 'seven', 'four']))).toBe(true);
  });
  it('fails when below count', () => {
    expect(checkGoal(goal, ctx(['seven', 'seven', 'zero', 'four', 'cherry']))).toBe(false);
  });
});

describe('checkGoal: no_symbol', () => {
  const goal: PuzzleGoal = { type: 'no_symbol', symbolId: 'four' };
  it('passes when the symbol is absent', () => {
    expect(checkGoal(goal, ctx(['seven', 'zero', 'cherry', 'lemon', 'grape']))).toBe(true);
  });
  it('fails when the symbol is present', () => {
    expect(checkGoal(goal, ctx(['four', 'zero', 'cherry', 'lemon', 'grape']))).toBe(false);
  });
});

describe('checkGoal: hand', () => {
  const goal: PuzzleGoal = { type: 'hand', handType: 'Two Pair' };
  it('passes when hand is exactly target', () => {
    expect(checkGoal(goal, ctx(['cherry', 'cherry', 'lemon', 'lemon', 'seven'], 'Two Pair'))).toBe(true);
  });
  it('passes when hand is stronger than target', () => {
    expect(checkGoal(goal, ctx([], 'Full House'))).toBe(true);
  });
  it('fails when hand is weaker than target', () => {
    expect(checkGoal(goal, ctx([], 'Pair'))).toBe(false);
  });
});

describe('checkGoal: score_at_least', () => {
  const goal: PuzzleGoal = { type: 'score_at_least', score: 500 };
  it('passes at exactly the threshold', () => {
    expect(checkGoal(goal, ctx([], 'No Hand', 500))).toBe(true);
  });
  it('passes above the threshold', () => {
    expect(checkGoal(goal, ctx([], 'No Hand', 999))).toBe(true);
  });
  it('fails below the threshold', () => {
    expect(checkGoal(goal, ctx([], 'No Hand', 499))).toBe(false);
  });
});

describe('checkGoal: set_bonus all-types', () => {
  // fruit set members: cherry, lemon, grape
  const goal: PuzzleGoal = { type: 'set_bonus', setId: 'fruit', bonusType: 'all-types' };
  it('passes when every fruit member is present', () => {
    expect(checkGoal(goal, ctx(['cherry', 'lemon', 'grape', 'seven', 'four']))).toBe(true);
  });
  it('fails when a fruit member is missing', () => {
    expect(checkGoal(goal, ctx(['cherry', 'lemon', 'seven', 'four', 'zero']))).toBe(false);
  });
  it('fails for an unknown set id', () => {
    const bad: PuzzleGoal = { type: 'set_bonus', setId: 'nope', bonusType: 'all-types' };
    expect(checkGoal(bad, ctx(['cherry', 'lemon', 'grape', 'cherry', 'lemon']))).toBe(false);
  });
});

describe('checkGoal: set_bonus all-symbols', () => {
  // gem set members: diamond, ruby, sapphire
  const goal: PuzzleGoal = { type: 'set_bonus', setId: 'gem', bonusType: 'all-symbols' };
  it('passes when all 5 cells are gems', () => {
    expect(checkGoal(goal, ctx(['diamond', 'ruby', 'sapphire', 'ruby', 'diamond']))).toBe(true);
  });
  it('fails when a cell is not a gem', () => {
    expect(checkGoal(goal, ctx(['diamond', 'ruby', 'sapphire', 'ruby', 'seven']))).toBe(false);
  });
  it('fails when the board is not exactly 5 cells', () => {
    expect(checkGoal(goal, ctx(['diamond', 'ruby', 'sapphire', 'ruby']))).toBe(false);
  });
});

describe('checkGoal: exact_board', () => {
  const goal: PuzzleGoal = {
    type: 'exact_board',
    board: ['seven', 'seven', 'seven', 'seven', 'seven'],
  };
  it('passes on an element-wise match', () => {
    expect(checkGoal(goal, ctx(['seven', 'seven', 'seven', 'seven', 'seven']))).toBe(true);
  });
  it('fails when one cell differs', () => {
    expect(checkGoal(goal, ctx(['seven', 'seven', 'seven', 'seven', 'zero']))).toBe(false);
  });
  it('fails when the order differs', () => {
    const g: PuzzleGoal = { type: 'exact_board', board: ['cherry', 'lemon', 'grape', 'seven', 'zero'] };
    expect(checkGoal(g, ctx(['lemon', 'cherry', 'grape', 'seven', 'zero']))).toBe(false);
  });
});

describe('checkPuzzleRun', () => {
  it('achieves a goal met on a later spin and counts correctly', () => {
    const goals: PuzzleGoal[] = [
      { type: 'no_symbol', symbolId: 'four' },
      { type: 'score_at_least', score: 500 },
    ];
    const spins: GoalContext[] = [
      // spin 1: no fours but only 200 pts
      ctx(['seven', 'zero', 'cherry', 'lemon', 'grape'], 'No Hand', 200),
      // spin 2: has a four (fails no_symbol) but scores 600 (meets score goal)
      ctx(['four', 'seven', 'cherry', 'lemon', 'grape'], 'No Hand', 600),
    ];
    const res = checkPuzzleRun(goals, spins);
    // no_symbol met on spin 1, score met on spin 2 → both achieved
    expect(res.achieved).toEqual([true, true]);
    expect(res.count).toBe(2);
  });

  it('marks a goal unmet when no spin satisfies it', () => {
    const goals: PuzzleGoal[] = [
      { type: 'contains_symbol_count', symbolId: 'seven', count: 5 },
      { type: 'score_at_least', score: 500 },
    ];
    const spins: GoalContext[] = [
      ctx(['seven', 'seven', 'seven', 'zero', 'four'], 'No Hand', 600),
    ];
    const res = checkPuzzleRun(goals, spins);
    expect(res.achieved).toEqual([false, true]);
    expect(res.count).toBe(1);
  });

  it('achieves nothing with no spins', () => {
    const goals: PuzzleGoal[] = [{ type: 'no_symbol', symbolId: 'four' }];
    const res = checkPuzzleRun(goals, []);
    expect(res.achieved).toEqual([false]);
    expect(res.count).toBe(0);
  });
});
