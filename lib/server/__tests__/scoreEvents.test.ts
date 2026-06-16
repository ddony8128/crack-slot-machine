import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { seasonBreakdown, recordSeasonChange } from '@/lib/server/seasonChange';

const SEASON_ID = 'season-1';

describe('season_scores cache (Db.upsertSeasonScore)', () => {
  it('overwrites the cached row on re-upsert', async () => {
    const db = new MemoryDb();
    await db.upsertSeasonScore({
      playerId: 'P1',
      seasonId: SEASON_ID,
      puzzleScore: 100,
      dailyScore: 20,
      spireScore: 0,
      totalScore: 120,
    });
    await db.upsertSeasonScore({
      playerId: 'P1',
      seasonId: SEASON_ID,
      puzzleScore: 200,
      dailyScore: 50,
      spireScore: 70,
      totalScore: 320,
    });

    // A second player's cache is independent.
    await db.upsertSeasonScore({
      playerId: 'P2',
      seasonId: SEASON_ID,
      puzzleScore: 10,
      dailyScore: 0,
      spireScore: 0,
      totalScore: 10,
    });

    const events = await db.listScoreEvents('P1', SEASON_ID);
    // upsertSeasonScore alone writes no ledger rows.
    expect(events).toEqual([]);
  });
});

describe('score_events ledger (insert + list newest-first)', () => {
  it('lists a player\'s events newest first, default limit 50', async () => {
    const db = new MemoryDb();
    const first = await db.insertScoreEvent({
      playerId: 'P1',
      seasonId: SEASON_ID,
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      previousTotalScore: 0,
      newTotalScore: 100,
      delta: 100,
      previousRank: null,
      newRank: 1,
    });
    const second = await db.insertScoreEvent({
      playerId: 'P1',
      seasonId: SEASON_ID,
      sourceType: 'SPIRE_BEST_UPDATED',
      sourceId: 'run-x',
      previousTotalScore: 100,
      newTotalScore: 250,
      delta: 150,
      previousRank: 1,
      newRank: 1,
    });
    // A different player's event must not leak in.
    await db.insertScoreEvent({
      playerId: 'P2',
      seasonId: SEASON_ID,
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      previousTotalScore: 0,
      newTotalScore: 100,
      delta: 100,
      previousRank: null,
      newRank: 2,
    });

    const events = await db.listScoreEvents('P1', SEASON_ID);
    expect(events.map((e) => e.id)).toEqual([second.id, first.id]); // newest first
    expect(events[0].sourceType).toBe('SPIRE_BEST_UPDATED');
    expect(events[0].sourceId).toBe('run-x');

    const limited = await db.listScoreEvents('P1', SEASON_ID, 1);
    expect(limited.map((e) => e.id)).toEqual([second.id]);
  });
});

describe('recordSeasonChange', () => {
  it('writes a ledger row + caches the total when the delta is non-zero', async () => {
    const db = new MemoryDb();
    const player = await db.createPlayer({
      nickname: 'ghost',
      contactType: 'email',
      contactValue: 'ghost@example.com',
      passwordHash: 'x',
    });

    const before = await seasonBreakdown(db, SEASON_ID, player.id);
    expect(before).toEqual({ total: 0, rank: null, puzzle: 0, daily: 0, spire: 0 });

    // Grant a puzzle best score, then record the change around it.
    await db.upsertBestScore({
      playerId: player.id,
      seasonId: SEASON_ID,
      mode: 'puzzle',
      scopeKey: 'p1',
      score: 130,
      seasonPoints: 130,
      cleared: true,
      runId: null,
    });
    const after = await seasonBreakdown(db, SEASON_ID, player.id);
    expect(after.total).toBe(130);
    expect(after.rank).toBe(1);

    const change = await recordSeasonChange(db, {
      seasonId: SEASON_ID,
      playerId: player.id,
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      before,
      after,
    });
    expect(change).toEqual({
      previousSeasonScore: 0,
      newSeasonScore: 130,
      delta: 130,
      previousRank: null,
      newRank: 1,
      reason: 'PUZZLE_CLEAR',
    });

    const events = await db.listScoreEvents(player.id, SEASON_ID);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      previousTotalScore: 0,
      newTotalScore: 130,
      delta: 130,
      previousRank: null,
      newRank: 1,
    });
  });

  it('writes NO ledger row when before == after, but still upserts the cache', async () => {
    const db = new MemoryDb();
    const player = await db.createPlayer({
      nickname: 'noop',
      contactType: 'email',
      contactValue: 'noop@example.com',
      passwordHash: 'x',
    });

    // Same breakdown for before and after (delta 0, same rank).
    const steady = { total: 130, rank: 1, puzzle: 130, daily: 0, spire: 0 };
    const change = await recordSeasonChange(db, {
      seasonId: SEASON_ID,
      playerId: player.id,
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      before: steady,
      after: steady,
    });
    expect(change.delta).toBe(0);

    const events = await db.listScoreEvents(player.id, SEASON_ID);
    expect(events).toEqual([]); // no event on a zero-delta, same-rank change

    // Cache was still refreshed (it always upserts).
    const second = await recordSeasonChange(db, {
      seasonId: SEASON_ID,
      playerId: player.id,
      sourceType: 'PUZZLE_CLEAR',
      sourceId: 'p1',
      before: steady,
      after: { ...steady, total: 230, puzzle: 230, rank: 1 },
    });
    expect(second.delta).toBe(100);
    expect((await db.listScoreEvents(player.id, SEASON_ID)).map((e) => e.delta)).toEqual([100]);
  });
});
