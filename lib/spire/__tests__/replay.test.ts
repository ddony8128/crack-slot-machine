import { describe, it, expect } from 'vitest';
import { createGameStore, type RunConfig, type RecordedAction } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { replaySpireRun, type SpireAction } from '@/lib/spire/replay';
import {
  initialSpireState,
  applyInitialSetChoice,
} from '@/lib/spire/state';
import {
  spireStageRunConfig,
  spireStageOutcome,
  spireStageTarget,
  goldBarMoney,
} from '@/lib/spire/stage';
import { rerollShop } from '@/lib/spire/state';
import { spireInterest, spireSpinBonus, spireClearPayout, SPIRE_FAIL_SUPPORT } from '@/lib/spire/config';

/** Drive a real store through a stage greedily (pick first offer → slot 0 →
 *  spin), stopping early once cumulative ≥ target (mimics the controller's
 *  immediate clear). Returns the recorded actions + per-spin scores. */
function playStage(seed: string, config: RunConfig, target: number) {
  const store = createGameStore(createSeededRng(seed));
  const s = () => store.getState();
  s().setNickname('t');
  s().configureRun(config);
  s().startGame();
  let guard = 0;
  while (s().status !== 'finished' && guard++ < 300) {
    const st = s();
    if (st.status === 'choosing-rule') {
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
      const cum = s().spinLogs.reduce((a, l) => a + l.roundScore, 0);
      if (cum >= target) break; // stage cleared — controller stops here
      st.next();
    } else {
      break;
    }
  }
  return {
    actions: s().getActions() as RecordedAction[],
    scores: s().spinLogs.map((l) => l.roundScore),
    boards: s().spinLogs.map((l) => l.finalResult),
  };
}

const RUN = 'spire-replay-test';

function stage1Setup() {
  const choice = applyInitialSetChoice(initialSpireState(RUN), 'fruit');
  if (!choice.ok) throw new Error('setup');
  const state = choice.state;
  const cfg = spireStageRunConfig(RUN, 1, 1, state.symbolBag, state.rulePool, state.handUpgrades);
  return { state, cfg, seed: `${RUN}:stage-1:attempt-1`, target: spireStageTarget(1) };
}

describe('replaySpireRun — set choice', () => {
  it('threads the initial set choice into state', () => {
    const res = replaySpireRun(RUN, [{ type: 'choose_set', chosenSetId: 'fruit' }]);
    expect(res.ok).toBe(true);
    expect(res.finalState.ownedSetIds).toContain('fruit');
    expect(res.finalState.symbolBag.zero).toBe(9);
    expect(res.finalState.rulePool).toHaveLength(10);
    expect(res.stagesCleared).toBe(0);
  });

  it('rejects choosing a set twice / playing before a set', () => {
    expect(replaySpireRun(RUN, [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'choose_set', chosenSetId: 'gem' },
    ]).ok).toBe(false);
    expect(replaySpireRun(RUN, [{ type: 'play_stage', actions: [] }]).ok).toBe(false);
  });
});

describe('replaySpireRun — stage consistency + settlement threading', () => {
  it('reproduces the greedy stage outcome and settles state', () => {
    const { cfg, seed, target } = stage1Setup();
    const played = playStage(seed, cfg, target);
    const stream: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'play_stage', actions: played.actions },
    ];
    const res = replaySpireRun(RUN, stream);
    expect(res.ok).toBe(true);

    const expected = spireStageOutcome(played.scores, target);
    expect(res.stageResults[0].cleared).toBe(expected.cleared);
    expect(res.stageResults[0].stageScore).toBe(expected.stageScore);

    if (expected.cleared) {
      // interest on pre-payout balance (0) + spin bonus + stage-1 payout
      const money = spireInterest(0) + spireSpinBonus(expected.remainingSpins) + spireClearPayout(1);
      expect(res.finalState.currentStage).toBe(2);
      expect(res.finalState.currentStageAttempt).toBe(1);
      expect(res.finalState.money).toBe(money);
      expect(res.finalState.totalRunScore).toBe(expected.stageScore);
      expect(res.stagesCleared).toBe(1);
    } else {
      expect(res.finalState.currentStage).toBe(1);
      expect(res.finalState.currentStageAttempt).toBe(2);
      expect(res.finalState.money).toBe(SPIRE_FAIL_SUPPORT); // +5 support, no other payout
      expect(res.finalState.totalRunScore).toBe(0);
      expect(res.stagesCleared).toBe(0);
    }
  });

  it('threads a shop purchase after the stage (money - cost)', () => {
    const { cfg, seed, target } = stage1Setup();
    const played = playStage(seed, cfg, target);
    const expected = spireStageOutcome(played.scores, target);
    const moneyAfterStage = expected.cleared
      ? spireInterest(0) + spireSpinBonus(expected.remainingSpins) + spireClearPayout(1)
      : SPIRE_FAIL_SUPPORT;

    const stream: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'play_stage', actions: played.actions },
      { type: 'buy_hand_flat', handType: 'Pair' }, // cost 1
    ];
    const res = replaySpireRun(RUN, stream);
    expect(res.ok).toBe(true);
    expect(res.finalState.money).toBe(moneyAfterStage - 1);
    expect(res.finalState.handUpgrades.Pair?.flatBonusCount).toBe(1);
  });

  it('rejects an unaffordable purchase', () => {
    // No stage played → money 0 → any buy fails.
    const res = replaySpireRun(RUN, [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'buy_hand_double', handType: 'Pair' }, // cost 3, money 0
    ]);
    expect(res.ok).toBe(false);
  });
});

describe('replaySpireRun — gold-bar accrual is deterministic', () => {
  it('adds exactly goldBarMoney(stage boards) before settlement', () => {
    // `choose_artifact` is now gated to a real 3/6/9 reward step (anti-cheat), so
    // gold-bar can no longer be back-door-injected before stage 1. Acquire it the
    // ONLY other legitimate way — a shop PURCHASE — using the +5 support granted
    // by the first (failed) attempt, then verify the next attempt accrues exactly
    // goldBarMoney(its boards) BEFORE settlement.
    //
    // GOLD_RUN is a probed seed (lib/spire/shop.spireRewardArtifacts-independent)
    // where, with the GEM set: stage-1 attempt-1 FAILS (→ +5 support) and attempt-2
    // produces a board with ≥4 gems (→ gold-bar pays +1). gold-bar does NOT affect
    // board generation (only number-specials do), so the SAME attempt-2 boards are
    // produced whether or not it is owned — the only delta is the accrued money.
    const GOLD_RUN = 'gemgold-28';
    const choice = applyInitialSetChoice(initialSpireState(GOLD_RUN), 'gem');
    if (!choice.ok) throw new Error('setup');
    const st = choice.state;
    const target = spireStageTarget(1);

    const cfg1 = spireStageRunConfig(GOLD_RUN, 1, 1, st.symbolBag, st.rulePool, st.handUpgrades);
    const p1 = playStage(`${GOLD_RUN}:stage-1:attempt-1`, cfg1, target);
    const oc1 = spireStageOutcome(p1.scores, target);
    expect(oc1.cleared).toBe(false); // attempt 1 must fail to bank +5 + open attempt 2

    // Attempt 2 is replayed under BOTH streams; with gold-bar owned its boards
    // produce gold (probe-verified > 0). Its actions are config-independent here.
    const cfg2 = spireStageRunConfig(GOLD_RUN, 1, 2, st.symbolBag, st.rulePool, st.handUpgrades, ['gold-bar']);
    const p2 = playStage(`${GOLD_RUN}:stage-1:attempt-2`, cfg2, target);
    const expectedGold = goldBarMoney(p2.boards, ['gold-bar']);
    expect(expectedGold).toBeGreaterThan(0);

    const base: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'gem' },
      { type: 'play_stage', actions: p1.actions }, // fail → money 0 → +5
      { type: 'play_stage', actions: p2.actions }, // 2nd attempt, no gold-bar
    ];
    const withGold: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'gem' },
      { type: 'play_stage', actions: p1.actions },         // fail → +5 support
      { type: 'buy_artifact', artifactId: 'gold-bar', cost: 5 }, // legit shop buy: 5 → 0
      { type: 'play_stage', actions: p2.actions },         // accrues gold before settle
    ];

    const baseRes = replaySpireRun(GOLD_RUN, base);
    const goldRes = replaySpireRun(GOLD_RUN, withGold);
    expect(baseRes.ok && goldRes.ok).toBe(true);

    // attempt-2 also fails (probe-verified), so NO interest applies to either run.
    // base attempt-2 settles from money 5; withGold settles from money 0 (after the
    // -5 buy) + expectedGold accrued before the fail's +5 support. The full delta is
    // therefore (expectedGold − buyCost).
    expect(goldRes.finalState.money - baseRes.finalState.money).toBe(expectedGold - 5);
  });
});

describe('replaySpireRun — choose_artifact is reward-gated (anti-cheat)', () => {
  it('rejects a choose_artifact that is NOT at a 3/6/9 reward step', () => {
    // No artifact stage cleared → no pending reward → any choose_artifact is a
    // tampering signal and must be rejected (offer-set validation, SP-H).
    const res = replaySpireRun(RUN, [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'choose_artifact', artifactId: 'watering-can' },
    ]);
    expect(res.ok).toBe(false);
    expect(res.rejectReason).toMatch(/reward step/);
  });

  it('rejects a skip (null) choose_artifact outside a reward step too', () => {
    const res = replaySpireRun(RUN, [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'choose_artifact', artifactId: null },
    ]);
    expect(res.ok).toBe(false);
  });
});

describe('chime (차임벨) — free-reroll determinism (direct reducer)', () => {
  it('first 2 rerolls free, 3rd deducts (per-visit index, no action field)', () => {
    // Mirror replaySpireRun's shopRerolls derivation exactly: a "shop visit" is
    // the rerolls after one stage; the first 2 are free when chime is owned.
    let state = initialSpireState(RUN);
    state = { ...state, money: 1, artifacts: ['chime'] };
    let shopRerolls = 0;
    for (let n = 0; n < 3; n++) {
      const free = state.artifacts.includes('chime') && shopRerolls < 2;
      shopRerolls += 1;
      const r = rerollShop(state, free);
      expect(r.ok).toBe(true);
      if (r.ok) state = r.state;
    }
    // 2 free (money unchanged) + 1 paid (1 → 0).
    expect(state.money).toBe(0);
  });
});
