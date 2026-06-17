import { describe, it, expect } from 'vitest';
import { rulePlayable } from '@/lib/rules/playable';
import { RULES_BY_ID } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { createGameStore } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';

describe('rulePlayable', () => {
  it('keeps cat/vehicle/monster rules OUT under BASE_WEIGHTS (no such symbols roll)', () => {
    expect(rulePlayable(RULES_BY_ID['cat-zoomies'], BASE_WEIGHTS)).toBe(false);
    expect(rulePlayable(RULES_BY_ID['vehicle-surge'], BASE_WEIGHTS)).toBe(false);
    expect(rulePlayable(RULES_BY_ID['monster-haunt'], BASE_WEIGHTS)).toBe(false);
  });
  it('keeps number/fruit/gem + generic rules playable under BASE_WEIGHTS', () => {
    expect(rulePlayable(RULES_BY_ID['seven-fever'], BASE_WEIGHTS)).toBe(true); // build '7'
    expect(rulePlayable(RULES_BY_ID['fruit-surge'], BASE_WEIGHTS)).toBe(true);
    expect(rulePlayable(RULES_BY_ID['gem-surge'], BASE_WEIGHTS)).toBe(true);
    expect(rulePlayable(RULES_BY_ID['center-lock'], BASE_WEIGHTS)).toBe(true); // build 'order'
  });
  it('a set rule becomes playable once its symbols can roll', () => {
    const withCats = { ...BASE_WEIGHTS, cheese_cat: 1, tuxedo_cat: 1, calico_cat: 1 } as typeof BASE_WEIGHTS;
    expect(rulePlayable(RULES_BY_ID['cat-zoomies'], withCats)).toBe(true);
  });
});

describe('빠른 게임/이벤트 offers exclude unrollable set rules', () => {
  it('never offers a cat/vehicle/monster rule in a no-config run', () => {
    const store = createGameStore(createSeededRng('offer-test'));
    const s = () => store.getState();
    s().setNickname('t');
    s().startGame(); // no config → legacy event/quick path
    const deadBuilds = new Set(['cat', 'vehicle', 'monster']);
    let guard = 0;
    while (s().status !== 'finished' && guard++ < 120) {
      const st = s();
      if (st.status === 'choosing-rule') {
        for (const r of st.offeredRules) {
          expect(deadBuilds.has(r.build ?? ''), `offered dead rule ${r.id}`).toBe(false);
          expect(rulePlayable(r, BASE_WEIGHTS)).toBe(true);
        }
        st.selectRule(st.offeredRules[0]);
        s().placePending({ type: 'slot', index: 0 });
      } else if (st.status === 'ready-to-spin') {
        st.spin();
      } else if (st.status === 'awaiting-selection') {
        const sel = st.pendingSelection!;
        const idx: number[] = [];
        for (let i = 0; i < sel.selectable.length && idx.length < sel.count; i++) {
          if (sel.selectable[i]) idx.push(i);
        }
        st.selectCells(idx);
      } else if (st.status === 'spin-result') {
        st.next();
      } else break;
    }
    expect(guard).toBeGreaterThan(1);
  });
});
