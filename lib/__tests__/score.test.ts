import { describe, it, expect } from 'vitest';
import type { SymbolType } from '@/types';
import {
  computeHand,
  computePenalty,
  countFours,
  scoreResult,
} from '@/lib/score';
import {
  ALL_FRUITS,
  ALL_GEMS,
  JACKPOT,
  PAIR,
  THREE_OF_A_KIND,
} from '@/data/scoreTable';

describe('score', () => {
  it('🍒🍒 0 0 4 => Pair(80) penalty 100 => roundScore -20', () => {
    const result: SymbolType[] = ['cherry', 'cherry', 'zero', 'zero', 'four'];
    const r = scoreResult(result);
    expect(r.hand).toBe('Pair');
    expect(r.handScore).toBe(PAIR);
    expect(r.penalty).toBe(100);
    expect(r.roundScore).toBe(-20);
  });

  it('0 0 0 0 0 => No Hand 0, penalty 0', () => {
    const result: SymbolType[] = ['zero', 'zero', 'zero', 'zero', 'zero'];
    const r = scoreResult(result);
    expect(r.hand).toBe('No Hand');
    expect(r.handScore).toBe(0);
    expect(r.penalty).toBe(0);
    expect(r.roundScore).toBe(0);
  });

  it('4 4 4 4 4 => penalty 700, hand No Hand, roundScore -700', () => {
    const result: SymbolType[] = ['four', 'four', 'four', 'four', 'four'];
    const r = scoreResult(result);
    expect(r.hand).toBe('No Hand');
    expect(r.handScore).toBe(0);
    expect(r.penalty).toBe(700);
    expect(r.roundScore).toBe(-700);
  });

  it('7 7 7 7 7 => JACKPOT 1000', () => {
    const result: SymbolType[] = ['seven', 'seven', 'seven', 'seven', 'seven'];
    const r = scoreResult(result);
    expect(r.hand).toBe('JACKPOT');
    expect(r.handScore).toBe(JACKPOT);
    expect(r.penalty).toBe(0);
    expect(r.roundScore).toBe(JACKPOT);
  });

  it('💎💎💎 0 4 => Three of a Kind 220, penalty 100 => 120', () => {
    const result: SymbolType[] = ['diamond', 'diamond', 'diamond', 'zero', 'four'];
    const r = scoreResult(result);
    expect(r.hand).toBe('Three of a Kind');
    expect(r.handScore).toBe(THREE_OF_A_KIND);
    expect(r.penalty).toBe(100);
    expect(r.roundScore).toBe(120);
  });

  it('all-fruits 5 cells => 250 (beats a pair)', () => {
    // cherry cherry lemon lemon grape: contains a pair, but all-fruits wins
    const result: SymbolType[] = ['cherry', 'cherry', 'lemon', 'lemon', 'grape'];
    const { hand, handScore } = computeHand(result);
    expect(handScore).toBe(ALL_FRUITS);
    expect(hand).toBe('All Fruits');
    expect(handScore).toBeGreaterThan(PAIR);
  });

  it('all-gems => 300', () => {
    const result: SymbolType[] = ['diamond', 'ruby', 'sapphire', 'diamond', 'ruby'];
    const { hand, handScore } = computeHand(result);
    expect(handScore).toBe(ALL_GEMS);
    expect(hand).toBe('All Gems');
  });

  it('fourCount 3 example penalty = 3*100+150 = 450', () => {
    const result: SymbolType[] = ['four', 'four', 'four', 'zero', 'cherry'];
    expect(countFours(result)).toBe(3);
    expect(computePenalty(result)).toBe(450);
  });
});
