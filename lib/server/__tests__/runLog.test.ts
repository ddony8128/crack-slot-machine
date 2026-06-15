import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { decodeSpireRun } from '@/lib/server/runLog';
import type { RunRow, ClientResults, FinalizeRunInput } from '@/lib/db/types';
import type { SpireAction } from '@/lib/spire/replay';

const SEED = 'run-log-test';

const EMPTY_RESULTS: ClientResults = { spins: [], finalScore: 0, bestSpinScore: 0 };

/** A minimal RunRow carrying a known seed + spire action stream. */
function spireRun(id: string, actions: SpireAction[], extra?: Partial<RunRow>): RunRow {
  return {
    id,
    eventId: null,
    playerId: 'player-1',
    seasonId: 'season-1',
    mode: 'spire',
    dailyDateKey: null,
    puzzleKey: null,
    stageIndex: null,
    cleared: null,
    clearedStageCount: 0,
    seasonPoints: null,
    nickname: 'tester',
    seed: SEED,
    actions,
    clientResults: EMPTY_RESULTS,
    score: 0,
    bestSpinScore: null,
    clientVersion: '2.0.0',
    rulesetVersion: 2,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    createdAt: '2026-06-15T00:00:00Z',
    submittedAt: '2026-06-15T01:00:00Z',
    ...extra,
  };
}

describe('decodeSpireRun', () => {
  it('decodes a set-choice-only run: ok, 0 stages, the set symbols in the bag, no artifacts', () => {
    const run = spireRun('run-decode', [{ type: 'choose_set', chosenSetId: 'fruit' }]);
    const s = decodeSpireRun(run);

    expect(s.ok).toBe(true);
    expect(s.stagesCleared).toBe(0);
    expect(s.artifactNames).toEqual([]);
    expect(s.failures).toBe(0);
    // The chosen 'fruit' set's symbols are mixed into the bag (cherry is one).
    expect(s.symbolBag.cherry ?? 0).toBeGreaterThan(0);
    // Bag always sums to 20.
    expect(Object.values(s.symbolBag).reduce((a, b) => a + b, 0)).toBe(20);
    // Base rule pool is present (resolved to display names, no raw ids leak when known).
    expect(s.rulePoolNames.length).toBeGreaterThan(0);
    expect(s.purchaseCount).toBe(0);
    expect(s.nickname).toBe('tester');
    expect(s.status).toBe('submitted');
  });

  it('counts buy_* and reroll_shop as purchases', () => {
    // Non-replayable stream is fine for the purchase count (it just scans types);
    // the count is derived from the action list, not the threaded state.
    const actions: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'buy_hand_flat', handType: 'Pair' },
      { type: 'reroll_shop' },
      { type: 'buy_rule', ruleId: 'x' },
      { type: 'choose_artifact', artifactId: null },
    ];
    const run = spireRun('run-purchases', actions);
    const s = decodeSpireRun(run);
    expect(s.purchaseCount).toBe(3); // buy_hand_flat + reroll_shop + buy_rule
  });

  it('falls back to stored score/clearedStageCount when the replay does not reproduce', () => {
    // Choosing a set twice is illegal → replay ok:false → use the stored values.
    const actions: SpireAction[] = [
      { type: 'choose_set', chosenSetId: 'fruit' },
      { type: 'choose_set', chosenSetId: 'gem' },
    ];
    const run = spireRun('run-bad', actions, { score: 4242, clearedStageCount: 7 });
    const s = decodeSpireRun(run);
    expect(s.ok).toBe(false);
    expect(s.totalScore).toBe(4242);
    expect(s.stagesCleared).toBe(7);
  });

  it('treats a null actions row as an empty stream', () => {
    const run = spireRun('run-null', [], { actions: null });
    const s = decodeSpireRun(run);
    expect(s.ok).toBe(true);
    expect(s.purchaseCount).toBe(0);
    expect(s.stagesCleared).toBe(0);
  });
});

describe('MemoryDb.listRecentRuns', () => {
  const finalize = (overrides?: Partial<FinalizeRunInput>): FinalizeRunInput => ({
    nickname: 'n',
    actions: [{ type: 'choose_set', chosenSetId: 'fruit' }],
    clientResults: EMPTY_RESULTS,
    score: 0,
    bestSpinScore: null,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: '2026-06-15T00:00:00Z',
    clearedStageCount: 0,
    ...overrides,
  });

  it('returns submitted runs newest-first and applies the mode filter + limit', async () => {
    const db = new MemoryDb();

    // Insert spire runs with increasing submittedAt.
    const a = await db.createRun({ mode: 'spire', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    const b = await db.createRun({ mode: 'spire', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    const c = await db.createRun({ mode: 'spire', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    await db.finalizeRun(a.id, finalize({ submittedAt: '2026-06-15T01:00:00Z' }));
    await db.finalizeRun(b.id, finalize({ submittedAt: '2026-06-15T03:00:00Z' }));
    await db.finalizeRun(c.id, finalize({ submittedAt: '2026-06-15T02:00:00Z' }));

    // A non-spire run that must be excluded by the mode filter.
    const q = await db.createRun({ mode: 'quick', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    await db.finalizeRun(q.id, finalize({ submittedAt: '2026-06-15T09:00:00Z' }));

    const recent = await db.listRecentRuns({ mode: 'spire', seasonId: 'season-1', status: 'submitted' });
    expect(recent.map((r) => r.id)).toEqual([b.id, c.id, a.id]); // newest submittedAt first
    expect(recent.every((r) => r.mode === 'spire')).toBe(true);

    const limited = await db.listRecentRuns({ mode: 'spire', limit: 2 });
    expect(limited.map((r) => r.id)).toEqual([b.id, c.id]);
  });

  it('filters out non-matching status and season', async () => {
    const db = new MemoryDb();
    const pending = await db.createRun({ mode: 'spire', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    // left pending — should be excluded by status filter
    const submitted = await db.createRun({ mode: 'spire', seasonId: 'season-1', seed: 's', clientVersion: '2.0.0', rulesetVersion: 2 });
    await db.finalizeRun(submitted.id, finalize());

    const recent = await db.listRecentRuns({ status: 'submitted' });
    expect(recent.map((r) => r.id)).toEqual([submitted.id]);
    expect(recent.some((r) => r.id === pending.id)).toBe(false);

    const otherSeason = await db.listRecentRuns({ seasonId: 'season-2' });
    expect(otherSeason).toEqual([]);
  });
});
