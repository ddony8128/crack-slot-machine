import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { seasonSnapshot, makeSeasonScoreChange } from '@/lib/server/seasonChange';

describe('seasonChange', () => {
  it('captures a grant as a before/after delta with rank entry', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    expect(season).not.toBeNull();
    const seasonId = season!.id;

    const player = await db.createPlayer({
      nickname: 'ghost',
      contactType: 'email',
      contactValue: 'ghost@example.com',
      passwordHash: 'x',
    });

    // Empty board → score 0, no rank yet.
    const before = await seasonSnapshot(db, seasonId, player.id);
    expect(before).toEqual({ score: 0, rank: null });

    // Grant a puzzle best score (100 + leftover×10 style; value itself is the grant).
    await db.upsertBestScore({
      playerId: player.id,
      seasonId,
      mode: 'puzzle',
      scopeKey: 'p1',
      score: 130,
      seasonPoints: 130,
      cleared: true,
      runId: null,
    });

    const after = await seasonSnapshot(db, seasonId, player.id);
    expect(after.score).toBe(130);
    expect(after.rank).toBe(1);

    const change = makeSeasonScoreChange(before, after, 'PUZZLE_CLEAR');
    expect(change).toEqual({
      previousSeasonScore: 0,
      newSeasonScore: 130,
      delta: 130,
      previousRank: null,
      newRank: 1,
      reason: 'PUZZLE_CLEAR',
    });
  });
});
