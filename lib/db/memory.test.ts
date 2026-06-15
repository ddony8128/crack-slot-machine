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

describe('MemoryDb puzzle records', () => {
  it('upsertPuzzleRecord keeps better: higher goals wins, equal goals fewer spins wins, worse ignored', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const scope = { playerId: 'p1', seasonId: season!.id, puzzleKey: 'pz1' };

    const a = await db.upsertPuzzleRecord({ ...scope, goalsAchieved: 1, spinCount: 10, runId: 'r1' });
    expect(a.bestGoalsAchieved).toBe(1);
    expect(a.bestSpinCount).toBe(10);
    expect(a.bestRunId).toBe('r1');

    // higher goals wins (even with more spins)
    const b = await db.upsertPuzzleRecord({ ...scope, goalsAchieved: 2, spinCount: 99, runId: 'r2' });
    expect(b.bestGoalsAchieved).toBe(2);
    expect(b.bestSpinCount).toBe(99);
    expect(b.bestRunId).toBe('r2');

    // equal goals, fewer spins wins
    const c = await db.upsertPuzzleRecord({ ...scope, goalsAchieved: 2, spinCount: 30, runId: 'r3' });
    expect(c.bestGoalsAchieved).toBe(2);
    expect(c.bestSpinCount).toBe(30);
    expect(c.bestRunId).toBe('r3');

    // worse: fewer goals -> ignored
    const d = await db.upsertPuzzleRecord({ ...scope, goalsAchieved: 1, spinCount: 1, runId: 'r4' });
    expect(d.bestGoalsAchieved).toBe(2);
    expect(d.bestSpinCount).toBe(30);
    expect(d.bestRunId).toBe('r3');

    // worse: equal goals, more spins -> ignored
    const e = await db.upsertPuzzleRecord({ ...scope, goalsAchieved: 2, spinCount: 50, runId: 'r5' });
    expect(e.bestSpinCount).toBe(30);
    expect(e.bestRunId).toBe('r3');

    // one row only
    expect((await db.listPlayerPuzzleRecords('p1', season!.id)).length).toBe(1);
  });

  it('getPuzzleDistribution buckets bestGoalsAchieved across players', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const mk = (playerId: string, goalsAchieved: number) =>
      db.upsertPuzzleRecord({
        playerId,
        seasonId: season!.id,
        puzzleKey: 'pz1',
        goalsAchieved,
        spinCount: 5,
        runId: null,
      });
    await mk('p1', 0);
    await mk('p2', 1);
    await mk('p3', 1);
    await mk('p4', 2);
    // different puzzle -> excluded
    await db.upsertPuzzleRecord({ playerId: 'p5', seasonId: season!.id, puzzleKey: 'pz2', goalsAchieved: 3, spinCount: 1, runId: null });
    // p1 improves to 1 -> moves bucket
    await mk('p1', 1);

    const dist = await db.getPuzzleDistribution(season!.id, 'pz1');
    expect(dist).toEqual({ 1: 3, 2: 1 });
  });
});

describe('MemoryDb quick best scores', () => {
  const QUICK_SCOPE = (seasonId: string | null) => ({
    seasonId,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  async function seedQuick(
    db: MemoryDb,
    seasonId: string | null,
    r: {
      nickname: string;
      score: number;
      best: number;
      submittedAt?: string;
      status?: 'submitted' | 'rejected';
      verified?: boolean;
      mode?: 'quick' | 'daily';
    },
  ) {
    const run = await db.createRun({
      seasonId,
      mode: r.mode ?? 'quick',
      seed: 's',
      ...VER,
    });
    await db.finalizeRun(run.id, {
      ...submitInput(r.nickname, r.score, r.best),
      status: r.status ?? 'submitted',
      verified: r.verified ?? true,
      submittedAt: r.submittedAt ?? new Date().toISOString(),
    });
  }

  it('dedupes by nickname keeping the higher score; counts only quick+verified+matching-season', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const seasonId = season!.id;

    // Same nickname twice -> keep the higher score.
    await seedQuick(db, seasonId, { nickname: 'Alice', score: 100, best: 10 });
    await seedQuick(db, seasonId, { nickname: 'Alice', score: 250, best: 30 });
    // Another nickname.
    await seedQuick(db, seasonId, { nickname: 'Bob', score: 200, best: 20 });

    // Excluded: rejected run.
    await seedQuick(db, seasonId, { nickname: 'Cheater', score: 9999, best: 999, status: 'rejected', verified: false });
    // Excluded: not verified.
    await seedQuick(db, seasonId, { nickname: 'Unver', score: 8888, best: 888, verified: false });
    // Excluded: wrong mode (daily).
    await seedQuick(db, seasonId, { nickname: 'Daily', score: 7777, best: 777, mode: 'daily' });
    // Excluded: different season bucket (null).
    await seedQuick(db, null, { nickname: 'Guest', score: 6666, best: 666 });

    const rows = await db.listQuickBestScores(QUICK_SCOPE(seasonId));
    expect(rows.map((r) => r.nickname)).toEqual(['Alice', 'Bob']);
    expect(rows[0].score).toBe(250); // higher of Alice's two
    expect(rows[1].score).toBe(200);

    // The null bucket sees only the guest run.
    const nullRows = await db.listQuickBestScores(QUICK_SCOPE(null));
    expect(nullRows.map((r) => r.nickname)).toEqual(['Guest']);
  });

  it('excludes mismatched versions', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const seasonId = season!.id;
    const run = await db.createRun({
      seasonId,
      mode: 'quick',
      seed: 's',
      clientVersion: CLIENT_VERSION,
      rulesetVersion: 999,
    });
    await db.finalizeRun(run.id, submitInput('OldRules', 500, 50));

    const rows = await db.listQuickBestScores(QUICK_SCOPE(seasonId));
    expect(rows).toEqual([]);
  });
});

describe('MemoryDb spire records', () => {
  it('upsertSpireRecord keeps better: higher stage wins, equal stage higher score wins, worse ignored', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();
    const scope = { playerId: 'p1', seasonId: season!.id };

    const a = await db.upsertSpireRecord({ ...scope, stageReached: 3, totalScore: 100, runId: 'r1' });
    expect(a.bestStageReached).toBe(3);
    expect(a.bestTotalScore).toBe(100);
    expect(a.bestRunId).toBe('r1');

    // higher stage wins (even with lower score)
    const b = await db.upsertSpireRecord({ ...scope, stageReached: 5, totalScore: 50, runId: 'r2' });
    expect(b.bestStageReached).toBe(5);
    expect(b.bestTotalScore).toBe(50);
    expect(b.bestRunId).toBe('r2');

    // equal stage, higher score wins
    const c = await db.upsertSpireRecord({ ...scope, stageReached: 5, totalScore: 80, runId: 'r3' });
    expect(c.bestTotalScore).toBe(80);
    expect(c.bestRunId).toBe('r3');

    // worse: lower stage -> ignored
    const d = await db.upsertSpireRecord({ ...scope, stageReached: 4, totalScore: 9999, runId: 'r4' });
    expect(d.bestStageReached).toBe(5);
    expect(d.bestTotalScore).toBe(80);
    expect(d.bestRunId).toBe('r3');

    // worse: equal stage, lower score -> ignored
    const e = await db.upsertSpireRecord({ ...scope, stageReached: 5, totalScore: 70, runId: 'r5' });
    expect(e.bestTotalScore).toBe(80);
    expect(e.bestRunId).toBe('r3');
  });

  it('getSpireRecord returns null then the row; listSpireRecords returns all', async () => {
    const db = new MemoryDb();
    const season = await db.getActiveSeason();

    expect(await db.getSpireRecord('p1', season!.id)).toBeNull();

    await db.upsertSpireRecord({ playerId: 'p1', seasonId: season!.id, stageReached: 2, totalScore: 10, runId: null });
    const row = await db.getSpireRecord('p1', season!.id);
    expect(row?.bestStageReached).toBe(2);
    expect(row?.bestTotalScore).toBe(10);

    await db.upsertSpireRecord({ playerId: 'p2', seasonId: season!.id, stageReached: 1, totalScore: 5, runId: null });
    expect((await db.listSpireRecords(season!.id)).length).toBe(2);
  });
});
