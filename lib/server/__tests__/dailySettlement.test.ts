import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { settleDueDailyChallenges } from '@/lib/server/dailySettlement';
import { dailyRankReward } from '@/lib/season/scoring';

const SEASON_ID = 'season-1';

/** Seed a daily challenge + N players' daily best_scores for one date. */
async function seedDay(
  db: MemoryDb,
  dateKey: string,
  endsAt: string,
  players: Array<{ playerId: string; score: number; updatedAt: string }>,
) {
  await db.upsertDailyChallenge({
    seasonId: SEASON_ID,
    dateKey,
    startsAt: `${dateKey}T03:00:00.000Z`,
    endsAt,
    seed: `seed-${dateKey}`,
    groupASetId: 'fruit',
    groupBSetId: 'gem',
  });
  for (const p of players) {
    const row = await db.upsertBestScore({
      playerId: p.playerId,
      seasonId: SEASON_ID,
      mode: 'daily',
      scopeKey: dateKey,
      score: p.score,
      seasonPoints: 0,
      runId: null,
    });
    // Pin updatedAt deterministically for the tiebreak/sort.
    row.updatedAt = p.updatedAt;
  }
}

describe('settleDueDailyChallenges', () => {
  it('settles an ended day: persists each rank reward + stamps settledAt', async () => {
    const db = new MemoryDb();
    const dateKey = '2026-06-15';
    await seedDay(db, dateKey, '2026-06-16T03:00:00.000Z', [
      { playerId: 'P1', score: 300, updatedAt: '2026-06-15T04:00:00.000Z' },
      { playerId: 'P2', score: 200, updatedAt: '2026-06-15T04:00:00.000Z' },
      { playerId: 'P3', score: 100, updatedAt: '2026-06-15T04:00:00.000Z' },
    ]);

    const nowIso = '2026-06-16T05:00:00.000Z'; // after the window ended
    await settleDueDailyChallenges(db, SEASON_ID, nowIso);

    const rows = await db.listDailyBestScores(SEASON_ID, dateKey); // sorted by score desc
    // N=3: rank1 → 50, rank2 → 30, rank3 → 0.
    expect(rows.map((r) => [r.playerId, r.seasonPoints])).toEqual([
      ['P1', dailyRankReward(1, 3)],
      ['P2', dailyRankReward(2, 3)],
      ['P3', dailyRankReward(3, 3)],
    ]);
    expect([dailyRankReward(1, 3), dailyRankReward(2, 3), dailyRankReward(3, 3)]).toEqual([
      50, 30, 0,
    ]);

    const challenge = await db.getDailyChallenge(SEASON_ID, dateKey);
    expect(challenge!.settledAt).toBe(nowIso);
  });

  it('is idempotent: a second pass does not double-write', async () => {
    const db = new MemoryDb();
    const dateKey = '2026-06-15';
    await seedDay(db, dateKey, '2026-06-16T03:00:00.000Z', [
      { playerId: 'P1', score: 300, updatedAt: '2026-06-15T04:00:00.000Z' },
      { playerId: 'P2', score: 200, updatedAt: '2026-06-15T04:00:00.000Z' },
    ]);

    await settleDueDailyChallenges(db, SEASON_ID, '2026-06-16T05:00:00.000Z');
    const firstChallenge = await db.getDailyChallenge(SEASON_ID, dateKey);
    const firstSettledAt = firstChallenge!.settledAt;
    const firstRows = (await db.listDailyBestScores(SEASON_ID, dateKey)).map(
      (r) => [r.playerId, r.seasonPoints] as const,
    );

    // Run again with a LATER nowIso — settledAt gate must skip it.
    await settleDueDailyChallenges(db, SEASON_ID, '2026-06-17T09:00:00.000Z');
    const secondChallenge = await db.getDailyChallenge(SEASON_ID, dateKey);
    const secondRows = (await db.listDailyBestScores(SEASON_ID, dateKey)).map(
      (r) => [r.playerId, r.seasonPoints] as const,
    );

    expect(secondChallenge!.settledAt).toBe(firstSettledAt); // not re-stamped
    expect(secondRows).toEqual(firstRows); // not re-written
  });

  it('does NOT settle a day whose window has not ended', async () => {
    const db = new MemoryDb();
    const dateKey = '2026-06-20';
    await seedDay(db, dateKey, '2026-06-21T03:00:00.000Z', [
      { playerId: 'P1', score: 300, updatedAt: '2026-06-20T13:00:00.000Z' },
      { playerId: 'P2', score: 100, updatedAt: '2026-06-20T13:00:00.000Z' },
    ]);

    // now is DURING the window.
    await settleDueDailyChallenges(db, SEASON_ID, '2026-06-20T20:00:00.000Z');

    const challenge = await db.getDailyChallenge(SEASON_ID, dateKey);
    expect(challenge!.settledAt).toBeNull();
    const rows = await db.listDailyBestScores(SEASON_ID, dateKey);
    expect(rows.every((r) => r.seasonPoints === 0)).toBe(true);
  });
});
