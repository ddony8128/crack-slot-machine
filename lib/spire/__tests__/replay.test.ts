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
    // Use the GEM set so boards can contain gem symbols at all.
    const choice = applyInitialSetChoice(initialSpireState(RUN), 'gem');
    if (!choice.ok) throw new Error('setup');
    const cfg = spireStageRunConfig(
      RUN, 1, 1, choice.state.symbolBag, choice.state.rulePool, choice.state.handUpgrades,
    );
    const seed = `${RUN}:stage-1:attempt-1`;
    const target = spireStageTarget(1);
    const played = playStage(seed, cfg, target);
    const outcome = spireStageOutcome(played.scores, target);

    const base: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'gem' },
      { type: 'play_stage', actions: played.actions },
    ];
    // gold-bar does NOT affect board generation (only number-specials do), so the
    // SAME stage boards are produced with or without it — the only state delta is
    // the accrued money (+ any interest it pushes up). Inject the artifact via
    // choose_artifact (v0 replay appends it) so both streams share identical play.
    const withGold: SpireAction[] = [
      { type: 'choose_artifact', artifactId: 'gold-bar' },
      ...base,
    ];

    const baseRes = replaySpireRun(RUN, base);
    const goldRes = replaySpireRun(RUN, withGold);
    expect(baseRes.ok && goldRes.ok).toBe(true);

    const expectedGold = goldBarMoney(played.boards, ['gold-bar']);
    // gold-bar is added BEFORE settlement. Pre-settle money is 0 for stage 1, so
    // on a CLEAR the extra interest is spireInterest(expectedGold) (ledger not
    // owned); on a FAIL no interest applies.
    const extraInterest = outcome.cleared ? spireInterest(expectedGold) : 0;
    expect(goldRes.finalState.money - baseRes.finalState.money).toBe(
      expectedGold + extraInterest,
    );
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
