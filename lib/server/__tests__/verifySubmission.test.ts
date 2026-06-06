import { describe, it, expect } from 'vitest';
import { createSeededRng } from '@/lib/rng';
import { createGameStore } from '@/store/gameStore';
import { replayRun } from '@/lib/replay';
import { verifySubmission } from '@/lib/server/verifySubmission';
import type { ClientResults } from '@/lib/db/types';

/** Play a seeded run to completion with deterministic choices; return seed+actions. */
function play(seed: string) {
  const store = createGameStore(createSeededRng(seed));
  const s = () => store.getState();
  s().setNickname('p');
  s().startGame();
  let guard = 0;
  while (s().status !== 'finished' && guard++ < 1000) {
    const st = s();
    if (st.status === 'choosing-rule') {
      st.selectRule(st.offeredRules[0]);
      s().placePending({ type: 'slot', index: 0 });
    } else if (st.status === 'ready-to-spin') st.spin();
    else if (st.status === 'awaiting-selection') {
      const sel = st.pendingSelection!;
      const picks: number[] = [];
      for (let i = 0; i < sel.selectable.length && picks.length < sel.count; i++)
        if (sel.selectable[i]) picks.push(i);
      st.selectCells(picks);
    } else if (st.status === 'spin-result') st.next();
    else if (st.pendingRule) s().placePending({ type: 'slot', index: 0 });
  }
  return { seed, actions: store.getState().getActions() };
}

function honestResults(seed: string, actions: ReturnType<typeof play>['actions']): ClientResults {
  const r = replayRun(seed, actions);
  return { spins: r.spins, finalScore: r.finalScore, bestSpinScore: r.bestSpinScore };
}

describe('verifySubmission', () => {
  it('accepts an honest submission and returns the server-computed score', () => {
    const { seed, actions } = play('verify-1');
    const client = honestResults(seed, actions);
    const out = verifySubmission(seed, actions, client);
    expect(out.status).toBe('submitted');
    if (out.status === 'submitted') {
      expect(out.score).toBe(client.finalScore);
      expect(out.bestSpinScore).toBe(client.bestSpinScore);
    }
  });

  it('rejects a tampered finalScore', () => {
    const { seed, actions } = play('verify-2');
    const client = honestResults(seed, actions);
    const tampered = { ...client, finalScore: client.finalScore + 1000 };
    const out = verifySubmission(seed, actions, tampered);
    expect(out).toEqual({ status: 'rejected', reason: 'final_score_mismatch' });
  });

  it('rejects a tampered spin board', () => {
    const { seed, actions } = play('verify-3');
    const client = honestResults(seed, actions);
    const spins = client.spins.map((s, i) =>
      i === 0 ? { ...s, finalBoard: ['seven', 'seven', 'seven', 'seven', 'seven'] as const } : s,
    );
    const out = verifySubmission(seed, actions, { ...client, spins: spins as ClientResults['spins'] });
    expect(out.status).toBe('rejected');
    expect(out).toMatchObject({ reason: 'spin_0_mismatch' });
  });

  it('rejects missing client results', () => {
    const { seed, actions } = play('verify-4');
    expect(verifySubmission(seed, actions, null).status).toBe('rejected');
  });

  it('rejects a structurally invalid action log', () => {
    const out = verifySubmission('verify-5', [{ type: 'selectRule', ruleId: 'nope' }], {
      spins: [],
      finalScore: 0,
      bestSpinScore: 0,
    });
    expect(out.status).toBe('rejected');
  });
});
