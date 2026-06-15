import { describe, it, expect } from 'vitest';
import { createGameStore } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { CATS, BASE_WEIGHTS } from '@/data/symbols';
import type { RunConfig } from '@/store/gameStore';
import type { SymbolType } from '@/types';

const CAT_SET = new Set<SymbolType>(CATS);

function freshStore(seed = 'prov-art') {
  const s = createGameStore(createSeededRng(seed));
  s.getState().setNickname('tester');
  return s;
}

/** A minimal spire-ish config (pool provisioning, custom artifacts). */
function spireish(partial: Partial<RunConfig>): RunConfig {
  return {
    provisioning: 'pool',
    rulePoolIds: ['seven-fever', 'fruit-surge', 'gem-surge', 'no-zero', 'diamond-cut'],
    numberSpecials: { four: false, zero: false },
    ...partial,
  };
}

describe('swiss-knife (맥가이버 칼) — 4 rule offers instead of 3', () => {
  it('offers 4 with the artifact', () => {
    const s = freshStore();
    s.getState().configureRun(spireish({ artifacts: ['swiss-knife'] }));
    s.getState().startGame();
    expect(s.getState().status).toBe('choosing-rule');
    expect(s.getState().offeredRules.length).toBe(4);
  });

  it('offers 3 without the artifact', () => {
    const s = freshStore();
    s.getState().configureRun(spireish({ artifacts: [] }));
    s.getState().startGame();
    expect(s.getState().status).toBe('choosing-rule');
    expect(s.getState().offeredRules.length).toBe(3);
  });
});

describe('engine (엔진) — +1 rule pick before the first spin', () => {
  it('startGame picksLeft is 2 with the artifact', () => {
    const s = freshStore();
    s.getState().configureRun(spireish({ artifacts: ['engine'] }));
    s.getState().startGame();
    expect(s.getState().picksLeft).toBe(2);
  });

  it('startGame picksLeft is 1 without the artifact', () => {
    const s = freshStore();
    s.getState().configureRun(spireish({ artifacts: [] }));
    s.getState().startGame();
    expect(s.getState().picksLeft).toBe(1);
  });
});

describe('melted-cat (녹아버린 고양이) — no cats on the stage first spin', () => {
  // A bag that is mostly cats + a few numbers. Without melted-cat the first
  // board would almost certainly contain cats; with it, spin 0 must be cat-free.
  const catHeavyWeights: Record<SymbolType, number> = {
    ...BASE_WEIGHTS,
    cheese_cat: 50,
    tuxedo_cat: 50,
    calico_cat: 50,
    seven: 1,
    zero: 1,
    four: 1,
    // zero out everything else so only cats + a few numbers can roll.
    cherry: 0,
    lemon: 0,
    grape: 0,
    diamond: 0,
    ruby: 0,
    sapphire: 0,
  };

  function configWith(artifacts: string[]): RunConfig {
    return {
      // 'fixed' so startGame goes straight to ready-to-spin (no rule offers; an
      // empty ruleSlots means the spin finalizes without a select-rule pause).
      provisioning: 'fixed',
      rulePoolIds: [],
      baseWeights: catHeavyWeights,
      numberSpecials: { four: false, zero: false },
      artifacts,
    };
  }

  function boardHasCat(board: SymbolType[]): boolean {
    return board.some((sym) => CAT_SET.has(sym));
  }

  it('spin 0 has no cat with the artifact; a later spin may', () => {
    const s = freshStore('melted-cat-seed');
    s.getState().configureRun(configWith(['melted-cat']));
    s.getState().startGame();
    expect(s.getState().status).toBe('ready-to-spin');

    s.getState().spin();
    expect(s.getState().status).toBe('spin-result');
    const firstBoard = s.getState().currentResult;
    expect(boardHasCat(firstBoard)).toBe(false);

    // Advance to spin 1 (spinIndex 1); cats are allowed again here.
    s.getState().next();
    expect(s.getState().status).toBe('ready-to-spin');
    expect(s.getState().spinIndex).toBe(1);
    s.getState().spin();
    expect(s.getState().status).toBe('spin-result');
    // With this seed + cat-heavy bag, the second board should contain a cat.
    expect(boardHasCat(s.getState().currentResult)).toBe(true);
  });

  it('without the artifact, spin 0 contains a cat (control)', () => {
    const s = freshStore('melted-cat-seed');
    s.getState().configureRun(configWith([]));
    s.getState().startGame();
    s.getState().spin();
    expect(s.getState().status).toBe('spin-result');
    expect(boardHasCat(s.getState().currentResult)).toBe(true);
  });
});
