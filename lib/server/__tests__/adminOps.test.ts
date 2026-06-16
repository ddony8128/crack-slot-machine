import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { settleDueDailyChallenges } from '@/lib/server/dailySettlement';
import {
  dailyDateKeysInRange,
  dailySeed,
  dailyWindow,
} from '@/lib/daily/challenge';
import { resolveDailySetup } from '@/lib/daily/run';
import { SEASON_STARTS_AT, SEASON_ENDS_AT } from '@/lib/season/config';

const SEASON_ID = 'season-1';

describe('invalidateRun', () => {
  it('marks a run rejected with the reason and clears verified', async () => {
    const db = new MemoryDb();
    const run = await db.createRun({
      seed: 's',
      clientVersion: 'v1',
      rulesetVersion: 1,
      mode: 'spire',
    });
    await db.finalizeRun(run.id, {
      nickname: 'P1',
      actions: [],
      clientResults: { spins: [], finalScore: 100, bestSpinScore: 10 },
      score: 100,
      bestSpinScore: 10,
      status: 'submitted',
      verified: true,
      rejectReason: null,
      submittedAt: '2026-06-16T05:00:00.000Z',
    });

    await db.invalidateRun(run.id, 'admin_invalidated');

    const after = await db.getRun(run.id);
    expect(after?.status).toBe('rejected');
    expect(after?.rejectReason).toBe('admin_invalidated');
    expect(after?.verified).toBe(false);
  });

  it('is a no-op for an unknown run id', async () => {
    const db = new MemoryDb();
    await expect(db.invalidateRun('nope', 'x')).resolves.toBeUndefined();
  });
});

describe('settleDueDailyChallenges return value', () => {
  it('returns the newly-settled dateKeys (and nothing on a re-run)', async () => {
    const db = new MemoryDb();
    const dateKey = '2026-06-15';
    await db.upsertDailyChallenge({
      seasonId: SEASON_ID,
      dateKey,
      startsAt: `${dateKey}T03:00:00.000Z`,
      endsAt: '2026-06-16T03:00:00.000Z',
      seed: dailySeed(dateKey),
      groupASetId: 'fruit',
      groupBSetId: 'gem',
    });
    await db.upsertBestScore({
      playerId: 'P1',
      seasonId: SEASON_ID,
      mode: 'daily',
      scopeKey: dateKey,
      score: 300,
      seasonPoints: 0,
      runId: null,
    });

    const first = await settleDueDailyChallenges(
      db,
      SEASON_ID,
      '2026-06-16T05:00:00.000Z',
    );
    expect(first).toEqual([dateKey]);

    // Second pass: already settled → nothing returned.
    const second = await settleDueDailyChallenges(
      db,
      SEASON_ID,
      '2026-06-17T05:00:00.000Z',
    );
    expect(second).toEqual([]);
  });
});

describe('daily-generate date range + upsert loop', () => {
  it('yields exactly 14 keys for the 14-day preseason range', () => {
    const keys = dailyDateKeysInRange(SEASON_STARTS_AT, SEASON_ENDS_AT);
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe('2026-06-16');
    expect(keys[13]).toBe('2026-06-29');
    expect(new Set(keys).size).toBe(14); // all distinct
  });

  it('upserts one challenge per key with the resolved setup', async () => {
    const db = new MemoryDb();
    const keys = dailyDateKeysInRange(SEASON_STARTS_AT, SEASON_ENDS_AT);
    for (const dateKey of keys) {
      const { groupASetId, groupBSetId, basicRuleSetId } =
        resolveDailySetup(dateKey);
      const { startsAt, endsAt } = dailyWindow(dateKey);
      await db.upsertDailyChallenge({
        seasonId: SEASON_ID,
        dateKey,
        startsAt,
        endsAt,
        seed: dailySeed(dateKey),
        groupASetId,
        groupBSetId,
        config: { basicRuleSetId },
      });
    }

    const rows = await db.listSeasonDailyChallenges(SEASON_ID);
    expect(rows).toHaveLength(14);

    // Re-running the loop is idempotent (upsert preserves the row count).
    for (const dateKey of keys) {
      const { groupASetId, groupBSetId } = resolveDailySetup(dateKey);
      const { startsAt, endsAt } = dailyWindow(dateKey);
      await db.upsertDailyChallenge({
        seasonId: SEASON_ID,
        dateKey,
        startsAt,
        endsAt,
        seed: dailySeed(dateKey),
        groupASetId,
        groupBSetId,
      });
    }
    expect(await db.listSeasonDailyChallenges(SEASON_ID)).toHaveLength(14);
  });
});
