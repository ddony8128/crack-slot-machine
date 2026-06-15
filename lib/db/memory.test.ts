import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import type { ClientResults, FinalizeRunInput } from '@/lib/db/types';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

const VER = { clientVersion: CLIENT_VERSION, rulesetVersion: RULESET_VERSION };

function clientResults(finalScore: number, bestSpinScore: number): ClientResults {
  return { spins: [], finalScore, bestSpinScore };
}

function submitInput(
  nickname: string,
  score: number,
  bestSpinScore: number,
): FinalizeRunInput {
  return {
    nickname,
    actions: [],
    clientResults: clientResults(score, bestSpinScore),
    score,
    bestSpinScore,
    status: 'submitted',
    verified: true,
    rejectReason: null,
    submittedAt: new Date().toISOString(),
  };
}

async function seedSubmitted(
  db: MemoryDb,
  slug: string,
  rows: Array<{ nickname: string; score: number; best: number }>,
) {
  const event = await db.getEventBySlug(slug);
  for (const r of rows) {
    const run = await db.createRun({ eventId: event!.id, seed: 's', ...VER });
    await db.finalizeRun(run.id, submitInput(r.nickname, r.score, r.best));
  }
}

describe('MemoryDb events', () => {
  it('seeds total/blackhaven/test with correct active flags', async () => {
    const db = new MemoryDb();
    expect((await db.getEventBySlug('total'))?.isActive).toBe(true);
    expect((await db.getEventBySlug('blackhaven'))?.isActive).toBe(true);
    expect((await db.getEventBySlug('test'))?.isActive).toBe(false);
    expect(await db.getEventBySlug('nope')).toBeNull();
  });

  it('creates and toggles events', async () => {
    const db = new MemoryDb();
    const created = await db.createEvent({ slug: 'party', title: 'Party' });
    expect(created.isActive).toBe(true);
    const off = await db.setEventActive('party', false);
    expect(off?.isActive).toBe(false);
    expect(off?.disabledAt).not.toBeNull();
    await expect(db.createEvent({ slug: 'party', title: 'dup' })).rejects.toThrow();
  });

  it('updates title/description and leaves slug + others intact', async () => {
    const db = new MemoryDb();
    await db.createEvent({ slug: 'party', title: 'Party', description: 'old' });
    const updated = await db.updateEvent('party', {
      title: 'New Party',
      description: 'fresh',
    });
    expect(updated?.slug).toBe('party');
    expect(updated?.title).toBe('New Party');
    expect(updated?.description).toBe('fresh');

    // partial update: only description; can clear to null
    const cleared = await db.updateEvent('party', { description: null });
    expect(cleared?.title).toBe('New Party'); // unchanged
    expect(cleared?.description).toBeNull();

    expect(await db.updateEvent('missing', { title: 'x' })).toBeNull();
  });
});

describe('MemoryDb leaderboard', () => {
  it('sorts by score desc, then bestSpin desc, and ranks/paginates', async () => {
    const db = new MemoryDb();
    await seedSubmitted(db, 'blackhaven', [
      { nickname: 'A', score: 100, best: 50 },
      { nickname: 'B', score: 300, best: 90 },
      { nickname: 'C', score: 300, best: 120 }, // ties score with B, higher best
    ]);
    const page = await db.listLeaderboard({
      slug: 'blackhaven',
      page: 1,
      pageSize: 2,
      ...VER,
    });
    expect(page.totalCount).toBe(3);
    expect(page.items.map((i) => i.nickname)).toEqual(['C', 'B']);
    expect(page.items[0].rank).toBe(1);

    const page2 = await db.listLeaderboard({
      slug: 'blackhaven',
      page: 2,
      pageSize: 2,
      ...VER,
    });
    expect(page2.items.map((i) => i.nickname)).toEqual(['A']);
    expect(page2.items[0].rank).toBe(3);
  });

  it("total slug aggregates across all events; per-event filters", async () => {
    const db = new MemoryDb();
    await seedSubmitted(db, 'blackhaven', [{ nickname: 'BH', score: 200, best: 40 }]);
    await seedSubmitted(db, 'test', [{ nickname: 'TST', score: 500, best: 99 }]);

    const total = await db.listLeaderboard({ slug: 'total', page: 1, pageSize: 10, ...VER });
    expect(total.items.map((i) => i.nickname)).toEqual(['TST', 'BH']);

    const bh = await db.listLeaderboard({ slug: 'blackhaven', page: 1, pageSize: 10, ...VER });
    expect(bh.items.map((i) => i.nickname)).toEqual(['BH']);
  });

  it('excludes pending/rejected and mismatched versions', async () => {
    const db = new MemoryDb();
    const event = await db.getEventBySlug('blackhaven');
    // pending (not finalized)
    await db.createRun({ eventId: event!.id, seed: 's', ...VER });
    // rejected
    const r = await db.createRun({ eventId: event!.id, seed: 's', ...VER });
    await db.finalizeRun(r.id, {
      ...submitInput('cheater', 9999, 9999),
      status: 'rejected',
      verified: false,
      rejectReason: 'mismatch',
    });
    // wrong ruleset version
    const r2 = await db.createRun({ eventId: event!.id, seed: 's', clientVersion: CLIENT_VERSION, rulesetVersion: 999 });
    await db.finalizeRun(r2.id, submitInput('oldrules', 1000, 100));

    const page = await db.listLeaderboard({ slug: 'blackhaven', page: 1, pageSize: 10, ...VER });
    expect(page.totalCount).toBe(0);
  });
});

describe('MemoryDb players', () => {
  it('creates a player and fetches it by id (active or soft-deleted)', async () => {
    const db = new MemoryDb();
    const p = await db.createPlayer({
      nickname: 'Alice',
      contactType: 'email',
      contactValue: 'a@example.com',
      passwordHash: 'hash',
    });
    expect(p.deletedAt).toBeNull();
    const fetched = await db.getPlayerById(p.id);
    expect(fetched?.nickname).toBe('Alice');
    expect(await db.getPlayerById('missing')).toBeNull();
  });

  it('getPlayerByNickname is case-insensitive and excludes soft-deleted', async () => {
    const db = new MemoryDb();
    const p = await db.createPlayer({
      nickname: 'Bob',
      contactType: 'phone',
      contactValue: '010',
      passwordHash: 'h',
    });
    expect((await db.getPlayerByNickname('bob'))?.id).toBe(p.id);
    expect((await db.getPlayerByNickname('BOB'))?.id).toBe(p.id);
    expect(await db.getPlayerByNickname('nobody')).toBeNull();

    // soft-delete -> excluded from getPlayerByNickname, still visible by id
    const fetched = await db.getPlayerById(p.id);
    fetched!.deletedAt = new Date().toISOString();
    expect(await db.getPlayerByNickname('bob')).toBeNull();
    expect((await db.getPlayerById(p.id))?.deletedAt).not.toBeNull();
  });
});

describe('MemoryDb seasons', () => {
  it('getActiveSeason returns the seeded Season 1; getSeasonBySlug matches', async () => {
    const db = new MemoryDb();
    const active = await db.getActiveSeason();
    expect(active?.slug).toBe('2026-06-season-1');
    expect(active?.title).toBe('RULE SLOT Season 1');
    expect(active?.rulesetVersion).toBe(2);
    expect(active?.isActive).toBe(true);

    const bySlug = await db.getSeasonBySlug('2026-06-season-1');
    expect(bySlug?.id).toBe(active?.id);
    expect(await db.getSeasonBySlug('nope')).toBeNull();
  });
});

describe('MemoryDb daily challenges', () => {
  it('upsertDailyChallenge is idempotent on (seasonId, dateKey)', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const input = {
      seasonId: season!.id,
      dateKey: '2026-06-15',
      startsAt: '2026-06-15T03:00:00Z',
      endsAt: '2026-06-16T03:00:00Z',
      seed: 'seed-1',
      groupASetId: 'A',
      groupBSetId: 'B',
    };
    const first = await db.upsertDailyChallenge(input);
    const second = await db.upsertDailyChallenge({ ...input, seed: 'seed-2' });
    expect(second.id).toBe(first.id);
    expect(second.seed).toBe('seed-1'); // existing kept, not overwritten
    expect((await db.getDailyChallenge(season!.id, '2026-06-15'))?.id).toBe(first.id);
  });

  it('countResolvedDailyRuns counts only submitted/rejected daily runs', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const player = await db.createPlayer({
      nickname: 'C',
      contactType: 'email',
      contactValue: 'c@e.com',
      passwordHash: 'h',
    });
    const dateKey = '2026-06-15';
    const base = {
      playerId: player.id,
      seasonId: season!.id,
      mode: 'daily' as const,
      dailyDateKey: dateKey,
      seed: 's',
      ...VER,
    };
    // submitted
    const r1 = await db.createRun(base);
    await db.finalizeRun(r1.id, submitInput('C', 100, 10));
    // rejected
    const r2 = await db.createRun(base);
    await db.finalizeRun(r2.id, {
      ...submitInput('C', 0, 0),
      status: 'rejected',
      verified: false,
      rejectReason: 'x',
    });
    // pending -> not counted
    await db.createRun(base);
    // different date -> not counted
    const other = await db.createRun({ ...base, dailyDateKey: '2026-06-16' });
    await db.finalizeRun(other.id, submitInput('C', 5, 1));
    // event-mode run -> not counted
    await db.createRun({ ...base, mode: 'event' });

    const count = await db.countResolvedDailyRuns({
      playerId: player.id,
      seasonId: season!.id,
      dateKey,
    });
    expect(count).toBe(2);
  });
});

describe('MemoryDb daily user status', () => {
  it('getDailyUserStatus returns null before any refill, true after setDailyAdRefillUsed', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const scope = { playerId: 'p1', seasonId: season!.id, dateKey: '2026-06-15' };

    expect(await db.getDailyUserStatus(scope)).toBeNull();

    const set = await db.setDailyAdRefillUsed(scope);
    expect(set.adRefillUsed).toBe(true);
    expect(set.playerId).toBe('p1');
    expect(set.dateKey).toBe('2026-06-15');

    const fetched = await db.getDailyUserStatus(scope);
    expect(fetched?.adRefillUsed).toBe(true);
  });

  it('setDailyAdRefillUsed is idempotent (one row, still true)', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const scope = { playerId: 'p1', seasonId: season!.id, dateKey: '2026-06-15' };

    const first = await db.setDailyAdRefillUsed(scope);
    const second = await db.setDailyAdRefillUsed(scope);
    expect(second.id).toBe(first.id);
    expect(second.adRefillUsed).toBe(true);
  });

  it('different (player/date) statuses are independent', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const base = { seasonId: season!.id, dateKey: '2026-06-15' };

    await db.setDailyAdRefillUsed({ ...base, playerId: 'p1' });

    // different player -> not affected
    expect(
      await db.getDailyUserStatus({ ...base, playerId: 'p2' }),
    ).toBeNull();
    // different date -> not affected
    expect(
      await db.getDailyUserStatus({ ...base, playerId: 'p1', dateKey: '2026-06-16' }),
    ).toBeNull();
    // original still set
    expect(
      (await db.getDailyUserStatus({ ...base, playerId: 'p1' }))?.adRefillUsed,
    ).toBe(true);
  });
});

describe('MemoryDb best scores', () => {
  it('upsertBestScore keeps the higher score and cleared is sticky-true', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const scope = {
      playerId: 'p1',
      seasonId: season!.id,
      mode: 'daily' as const,
      scopeKey: '2026-06-15',
    };
    const a = await db.upsertBestScore({ ...scope, score: 100, seasonPoints: 10, cleared: false, runId: 'r1' });
    expect(a.score).toBe(100);
    expect(a.cleared).toBe(false);

    // lower score -> score kept, but cleared becomes sticky true
    const b = await db.upsertBestScore({ ...scope, score: 50, seasonPoints: 5, cleared: true, runId: 'r2' });
    expect(b.score).toBe(100);
    expect(b.seasonPoints).toBe(10);
    expect(b.runId).toBe('r1');
    expect(b.cleared).toBe(true);

    // higher score -> replaced; cleared stays true even if new is false
    const c = await db.upsertBestScore({ ...scope, score: 200, seasonPoints: 20, cleared: false, runId: 'r3' });
    expect(c.score).toBe(200);
    expect(c.seasonPoints).toBe(20);
    expect(c.runId).toBe('r3');
    expect(c.cleared).toBe(true);
  });

  it('listDailyBestScores orders by score desc then updatedAt asc', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const dateKey = '2026-06-15';
    const mk = (playerId: string, score: number) =>
      db.upsertBestScore({
        playerId,
        seasonId: season!.id,
        mode: 'daily',
        scopeKey: dateKey,
        score,
        seasonPoints: 0,
        runId: null,
      });
    await mk('p1', 100);
    await mk('p2', 300);
    await mk('p3', 300); // ties p2 on score, inserted later -> ranks after p2

    const rows = await db.listDailyBestScores(season!.id, dateKey);
    expect(rows.map((r) => r.playerId)).toEqual(['p2', 'p3', 'p1']);
  });

  it('listSeasonBestScores returns all rows; listPlayerBestScores filters by player', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    await db.upsertBestScore({ playerId: 'p1', seasonId: season!.id, mode: 'daily', scopeKey: 'd1', score: 1, seasonPoints: 0, runId: null });
    await db.upsertBestScore({ playerId: 'p1', seasonId: season!.id, mode: 'puzzle', scopeKey: 'pz1', score: 2, seasonPoints: 0, runId: null });
    await db.upsertBestScore({ playerId: 'p2', seasonId: season!.id, mode: 'daily', scopeKey: 'd1', score: 3, seasonPoints: 0, runId: null });

    expect((await db.listSeasonBestScores(season!.id)).length).toBe(3);
    expect((await db.listPlayerBestScores('p1', season!.id)).length).toBe(2);
  });
});
