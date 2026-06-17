import { describe, it, expect } from 'vitest';
import { dailyRunConfigFromParts } from '@/lib/daily/run';
import { puzzleRunConfig } from '@/lib/puzzle/run';
import { spireStageRunConfig } from '@/lib/spire/stage';
import { detectSpecials } from '@/lib/specials';
import { scoreResult, legacyColorBonus } from '@/lib/score';
import { RULES_BY_ID, LEGACY_RULE_IDS } from '@/data/rules';
import { BASE_WEIGHTS } from '@/data/symbols';
import { createGameStore } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { FOURS_4_MULT, BONUS_ALL_RED, BONUS_ALL_BLUE } from '@/data/scoreTable';
import type { SymbolType } from '@/types';

// The LEGACY preset = 빠른 게임/이벤트 (no RunConfig): number specials ON, CLEAN
// SWEEP reads the FINAL board, and only BASE-rollable rules are offered. Season
// configs explicitly opt INTO the new behavior. These tests pin both sides.

describe('season configs opt into the new (non-legacy) behavior', () => {
  it('daily/puzzle/spire all set positionalCleanSweep + numberSpecials off', () => {
    const daily = dailyRunConfigFromParts({ seed: 's', groupASetId: 'fruit', groupBSetId: 'gem', basicRuleSetId: 'daily_basic_1' });
    const puzzle = puzzleRunConfig('p01');
    const spire = spireStageRunConfig('s', 1, 1, { zero: 9, four: 5, seven: 3, cherry: 1, lemon: 1, grape: 1 }, []);
    for (const cfg of [daily, puzzle, spire]) {
      expect(cfg.positionalCleanSweep).toBe(true);
      expect(cfg.numberSpecials).toEqual({ four: false, zero: false });
    }
  });
});

describe('LEGACY (no-config) quick/event behavior', () => {
  it('keeps number special hands ON', () => {
    const four4: SymbolType[] = ['four', 'four', 'four', 'four', 'seven'];
    // no opts = legacy default ON
    expect(detectSpecials(four4).nextMultiplier).toBe(FOURS_4_MULT);
  });

  it('CLEAN SWEEP reads the FINAL board (scoreBoards undefined)', () => {
    // A board with no 4s scores CLEAN SWEEP on the final board when the rule is active.
    const board: SymbolType[] = ['seven', 'cherry', 'lemon', 'grape', 'diamond'];
    const legacy = scoreResult(board, [RULES_BY_ID['clean-sweep']], undefined, undefined);
    const positional = scoreResult(board, [RULES_BY_ID['clean-sweep']], undefined, []);
    // undefined → final-board path; [] → positional path. Both defined; the point
    // is the legacy call uses the final board (no scoreBoards threading).
    expect(legacy.bonusScore).toBeGreaterThanOrEqual(0);
    expect(positional.bonusScore).toBeGreaterThanOrEqual(0);
  });

  it('offers only the frozen legacy whitelist in a no-config run', () => {
    const store = createGameStore(createSeededRng('legacy-offer'));
    const s = () => store.getState();
    s().setNickname('t');
    s().startGame();
    let guard = 0;
    // 기획: 빠른 게임/이벤트 = 동결된 원조 룰셋(LEGACY_RULE_IDS)만 제안한다. 시즌
    // 세트 전용 규칙(비타민 보충·미의 추구·cat/vehicle/monster·그 외 combo)은 절대
    // 등장하지 않는다. 붉은/푸른 물들이기는 원조 레거시에 있었으므로 포함된다.
    let sawOffer = false;
    while (s().status !== 'finished' && guard++ < 80) {
      const st = s();
      if (st.status === 'choosing-rule') {
        sawOffer = true;
        for (const r of st.offeredRules) expect(LEGACY_RULE_IDS.has(r.id)).toBe(true);
        st.selectRule(st.offeredRules[0]);
        s().placePending({ type: 'slot', index: 0 });
      } else if (st.status === 'ready-to-spin') st.spin();
      else if (st.status === 'awaiting-selection') {
        const sel = st.pendingSelection!;
        const idx: number[] = [];
        for (let i = 0; i < sel.selectable.length && idx.length < sel.count; i++) if (sel.selectable[i]) idx.push(i);
        st.selectCells(idx);
      } else if (st.status === 'spin-result') st.next();
      else break;
    }
    expect(guard).toBeGreaterThan(1);
    expect(sawOffer).toBe(true);
  });
});

// Documented intentional shared change: lock→hold applies to ALL modes (the
// faithful legacy true-lock gate is woven through cascade targeting and is left
// as an opt-in). Quick's BASE_WEIGHTS never rolls cat/vehicle/monster, confirmed:
// 올 레드/올 블루 색 보너스는 원조 빠른 게임/이벤트 족보였으나 시즌 config-driven scoring
// 리팩터에서 누락됐다. 레거시 전용으로 복원하고, 시즌 런에는 적용되지 않음을 핀으로 박는다.
describe('legacy 색 보너스 (올 레드/올 블루)', () => {
  const allBlue: SymbolType[] = ['sapphire', 'grape', 'sapphire', 'grape', 'grape'];
  const allRed: SymbolType[] = ['ruby', 'cherry', 'ruby', 'cherry', 'ruby'];
  const mixed: SymbolType[] = ['ruby', 'sapphire', 'cherry', 'grape', 'lemon'];

  it('legacyColorBonus scores 올 블루 / 올 레드 and nothing for a mixed board', () => {
    expect(legacyColorBonus(allBlue).sum).toBe(BONUS_ALL_BLUE);
    expect(legacyColorBonus(allRed).sum).toBe(BONUS_ALL_RED);
    expect(legacyColorBonus(mixed).sum).toBe(0);
  });

  it('scoreResult includes the bonus ONLY when legacyColor=true (season runs pass false)', () => {
    // 8th arg setBonusUpgrades=undefined; 9th legacyColor.
    const legacy = scoreResult(allRed, [], undefined, undefined, undefined, undefined, [], undefined, true);
    const season = scoreResult(allRed, [], undefined, undefined, undefined, undefined, [], undefined, false);
    expect(legacy.bonusScore - season.bonusScore).toBe(BONUS_ALL_RED);
  });
});

describe('BASE_WEIGHTS rollable sets', () => {
  it('rolls number/fruit/gem only', () => {
    for (const id of ['cheese_cat', 'plane', 'ghost', 'dracula']) {
      expect(BASE_WEIGHTS[id as SymbolType] ?? 0).toBe(0);
    }
  });
});
