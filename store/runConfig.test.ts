import { describe, it, expect } from 'vitest';
import { createGameStore } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { puzzleRunConfig } from '@/lib/puzzle/run';
import type { SymbolType } from '@/types';

function freshStore() {
  const s = createGameStore(createSeededRng('rc-test'));
  s.getState().setNickname('tester');
  return s;
}

describe('RunConfig (configurable-run mode)', () => {
  it('no config → legacy behavior (choosing-rule, 00000 start, 7 spins)', () => {
    const s = freshStore();
    s.getState().startGame();
    const st = s.getState();
    expect(st.status).toBe('choosing-rule');
    expect(st.maxSpins).toBe(7);
    expect(st.previousResult).toEqual(['zero', 'zero', 'zero', 'zero', 'zero']);
    expect(st.offeredRules.length).toBe(3);
  });

  it("'fixed' provisioning: rules pre-loaded in the bag, ready-to-spin, custom board + maxSpins", () => {
    const board: SymbolType[] = ['zero', 'four', 'seven', 'cherry', 'ruby'];
    const s = freshStore();
    s.getState().configureRun({
      provisioning: 'fixed',
      rulePoolIds: ['select-reroll', 'seven-fever'],
      initialBoard: board,
      maxSpins: 5,
    });
    s.getState().startGame();
    const st = s.getState();
    expect(st.status).toBe('ready-to-spin');
    expect(st.maxSpins).toBe(5);
    expect(st.previousResult).toEqual(board);
    expect(st.offeredRules).toEqual([]);
    expect(st.bag.map((r) => r.id).sort()).toEqual(['select-reroll', 'seven-fever']);
    expect(st.ruleSlots.every((r) => r === null)).toBe(true);
  });

  it("'pool' provisioning: offers are drawn only from the pool", () => {
    const pool = ['seven-fever', 'fruit-surge', 'gem-surge', 'bonus-77'];
    const s = freshStore();
    s.getState().configureRun({ provisioning: 'pool', rulePoolIds: pool });
    s.getState().startGame();
    const st = s.getState();
    expect(st.status).toBe('choosing-rule');
    expect(st.offeredRules.length).toBe(3);
    for (const r of st.offeredRules) expect(pool).toContain(r.id);
  });

  it('reset() clears the config (next run is legacy)', () => {
    const s = freshStore();
    s.getState().configureRun({ provisioning: 'fixed', rulePoolIds: ['seven-fever'], maxSpins: 3 });
    s.getState().startGame();
    expect(s.getState().status).toBe('ready-to-spin');
    s.getState().reset();
    s.getState().setNickname('tester');
    s.getState().startGame();
    expect(s.getState().status).toBe('choosing-rule');
    expect(s.getState().maxSpins).toBe(7);
  });

  it('puzzleRunConfig builds a fixed config from a puzzle key', () => {
    const cfg = puzzleRunConfig('p01');
    expect(cfg.provisioning).toBe('fixed');
    expect(cfg.maxSpins).toBe(5);
    expect(cfg.initialBoard).toEqual(['four', 'four', 'four', 'four', 'four']);
    expect(cfg.rulePoolIds).toContain('seven-fever');
    // Numbers-only symbol bag: 0/4/7 rollable, everything else weight 0.
    expect(cfg.baseWeights?.seven).toBe(1);
    expect(cfg.baseWeights?.zero).toBe(1);
    expect(cfg.baseWeights?.four).toBe(1);
    expect(cfg.baseWeights?.cherry).toBe(0);
    expect(cfg.baseWeights?.ruby).toBe(0);
    expect(() => puzzleRunConfig('nope')).toThrow();
  });
});
