import { describe, it, expect } from 'vitest';
import { createGameStore, type RunConfig, type RecordedAction } from '@/store/gameStore';
import { createSeededRng } from '@/lib/rng';
import { verifySpireRun } from '@/lib/spire/verify';
import { replaySpireRun, type SpireAction } from '@/lib/spire/replay';
import { pickSpireSetChoices } from '@/lib/spire/run';
import { initialSpireState, applyInitialSetChoice } from '@/lib/spire/state';
import { spireStageRunConfig, spireStageTarget } from '@/lib/spire/stage';

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
      if (s().spinLogs.reduce((a, l) => a + l.roundScore, 0) >= target) break;
      st.next();
    } else break;
  }
  return s().getActions() as RecordedAction[];
}

const RUN = 'spire-verify-test';
const CHOSEN = pickSpireSetChoices(RUN)[0]; // a legitimately-offered set

function validStream(): SpireAction[] {
  const choice = applyInitialSetChoice(initialSpireState(RUN), CHOSEN);
  if (!choice.ok) throw new Error('setup');
  const cfg = spireStageRunConfig(RUN, 1, 1, choice.state.symbolBag, choice.state.rulePool);
  const actions = playStage(`${RUN}:stage-1:attempt-1`, cfg, spireStageTarget(1));
  return [
    { type: 'choose_set', chosenSetId: CHOSEN },
    { type: 'play_stage', actions },
  ];
}

describe('verifySpireRun', () => {
  it('accepts a faithful run and returns the replay-derived numbers', () => {
    const stream = validStream();
    const truth = replaySpireRun(RUN, stream);
    const res = verifySpireRun(RUN, stream, {
      stagesCleared: truth.stagesCleared,
      totalScore: truth.totalRunScore,
    });
    expect(res.status).toBe('submitted');
    if (res.status === 'submitted') {
      expect(res.stagesCleared).toBe(truth.stagesCleared);
      expect(res.totalScore).toBe(truth.totalRunScore);
    }
  });

  it('rejects a stagesCleared / totalScore claim mismatch', () => {
    const stream = validStream();
    const truth = replaySpireRun(RUN, stream);
    expect(
      verifySpireRun(RUN, stream, { stagesCleared: truth.stagesCleared + 1, totalScore: truth.totalRunScore }).status,
    ).toBe('rejected');
    expect(
      verifySpireRun(RUN, stream, { stagesCleared: truth.stagesCleared, totalScore: truth.totalRunScore + 999 }).status,
    ).toBe('rejected');
  });

  it('rejects a set that the seed did not offer', () => {
    const notOffered = ['fruit', 'gem', 'cat', 'vehicle', 'monster'].find(
      (s) => !pickSpireSetChoices(RUN).includes(s),
    )!;
    const res = verifySpireRun(RUN, [{ type: 'choose_set', chosenSetId: notOffered }]);
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') expect(res.reason).toBe('invalid_set_choice');
  });

  it('rejects a tampered (illegal) action stream', () => {
    // buy with no money → replay rejects
    const res = verifySpireRun(RUN, [
      { type: 'choose_set', chosenSetId: CHOSEN },
      { type: 'buy_hand_double', handType: 'Pair' },
    ]);
    expect(res.status).toBe('rejected');
  });

  it('accepts with no claim (server is authoritative)', () => {
    expect(verifySpireRun(RUN, validStream()).status).toBe('submitted');
  });
});
