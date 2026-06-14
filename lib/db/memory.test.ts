import { describe, it, expect } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import type { ClientResults, FinalizeRunInput } from '@/lib/db/types';
import type { AchievementKey } from '@/types';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

const VER = { clientVersion: CLIENT_VERSION, rulesetVersion: RULESET_VERSION };

function clientResults(finalScore: number, bestSpinScore: number): ClientResults {
  return { spins: [], finalScore, bestSpinScore };
}

function submitInput(
  nickname: string,
  score: number,
  bestSpinScore: number,
  achievements: AchievementKey[] = [],
): FinalizeRunInput {
  return {
    nickname,
    achievements,
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
    const run = await db.createRun({
      eventId: event!.id,
      playerId: null,
      seed: 's',
      ...VER,
    });
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
    await db.createRun({ eventId: event!.id, playerId: null, seed: 's', ...VER });
    // rejected
    const r = await db.createRun({ eventId: event!.id, playerId: null, seed: 's', ...VER });
    await db.finalizeRun(r.id, {
      ...submitInput('cheater', 9999, 9999),
      status: 'rejected',
      verified: false,
      rejectReason: 'mismatch',
    });
    // wrong ruleset version
    const r2 = await db.createRun({ eventId: event!.id, playerId: null, seed: 's', clientVersion: CLIENT_VERSION, rulesetVersion: 999 });
    await db.finalizeRun(r2.id, submitInput('oldrules', 1000, 100));

    const page = await db.listLeaderboard({ slug: 'blackhaven', page: 1, pageSize: 10, ...VER });
    expect(page.totalCount).toBe(0);
  });

  it('dedupes to the best score per nickname; totalCount counts distinct nicknames', async () => {
    const db = new MemoryDb();
    await seedSubmitted(db, 'blackhaven', [
      { nickname: 'Dup', score: 100, best: 10 },
      { nickname: 'Dup', score: 300, best: 20 },
      { nickname: 'Solo', score: 200, best: 15 },
    ]);
    const page = await db.listLeaderboard({
      slug: 'blackhaven',
      page: 1,
      pageSize: 10,
      ...VER,
    });
    expect(page.totalCount).toBe(2);
    const dup = page.items.filter((i) => i.nickname === 'Dup');
    expect(dup).toHaveLength(1);
    expect(dup[0].score).toBe(300);
    expect(page.items.map((i) => i.nickname)).toEqual(['Dup', 'Solo']);
  });
});

describe('MemoryDb players', () => {
  it('creates and lists players (newest first); duplicate active nickname throws', async () => {
    const db = new MemoryDb();
    const a = await db.createPlayer('Alice');
    const b = await db.createPlayer('Bob');
    const list = await db.listPlayers();
    expect(list.map((p) => p.id)).toEqual([b.id, a.id]); // newest first
    await expect(db.createPlayer('alice')).rejects.toThrow(); // case-insensitive dup
  });

  it('soft delete hides from active list but includeDeleted shows it; restore brings it back', async () => {
    const db = new MemoryDb();
    const p = await db.createPlayer('Carol');
    const deleted = await db.softDeletePlayer(p.id);
    expect(deleted?.deletedAt).not.toBeNull();

    expect((await db.listPlayers()).map((x) => x.id)).not.toContain(p.id);
    expect((await db.listPlayers({ includeDeleted: true })).map((x) => x.id)).toContain(p.id);

    const restored = await db.restorePlayer(p.id);
    expect(restored?.deletedAt).toBeNull();
    expect((await db.listPlayers()).map((x) => x.id)).toContain(p.id);
  });

  it('getActivePlayerByNickname is case-insensitive and excludes soft-deleted', async () => {
    const db = new MemoryDb();
    const p = await db.createPlayer('Dave');
    expect((await db.getActivePlayerByNickname('DAVE'))?.id).toBe(p.id);

    await db.softDeletePlayer(p.id);
    expect(await db.getActivePlayerByNickname('dave')).toBeNull();

    // after deletion the nickname can be re-registered (no active conflict)
    const p2 = await db.createPlayer('dave');
    expect(p2.id).not.toBe(p.id);
  });

  it('soft/restore on a missing id returns null', async () => {
    const db = new MemoryDb();
    expect(await db.softDeletePlayer('nope')).toBeNull();
    expect(await db.restorePlayer('nope')).toBeNull();
  });
});

describe('MemoryDb rewards', () => {
  it('getPlayerBestScore returns null before any run, then the max', async () => {
    const db = new MemoryDb();
    const event = await db.getEventBySlug('blackhaven');
    const player = await db.createPlayer('Eve');

    expect(await db.getPlayerBestScore(player.id, event!.id)).toBeNull();

    const r1 = await db.createRun({ eventId: event!.id, playerId: player.id, seed: 's', ...VER });
    await db.finalizeRun(r1.id, submitInput('Eve', 120, 30));
    const r2 = await db.createRun({ eventId: event!.id, playerId: player.id, seed: 's', ...VER });
    await db.finalizeRun(r2.id, submitInput('Eve', 250, 40));

    expect(await db.getPlayerBestScore(player.id, event!.id)).toBe(250);
  });

  it('getPlayerAchievements unions across the player runs (deduped)', async () => {
    const db = new MemoryDb();
    const event = await db.getEventBySlug('blackhaven');
    const player = await db.createPlayer('Frank');

    expect(await db.getPlayerAchievements(player.id, event!.id)).toEqual([]);

    const r1 = await db.createRun({ eventId: event!.id, playerId: player.id, seed: 's', ...VER });
    await db.finalizeRun(r1.id, submitInput('Frank', 100, 10, ['midas', 'frankenstein']));
    const r2 = await db.createRun({ eventId: event!.id, playerId: player.id, seed: 's', ...VER });
    await db.finalizeRun(r2.id, submitInput('Frank', 200, 20, ['midas', 'hyakki']));

    const got = await db.getPlayerAchievements(player.id, event!.id);
    expect([...got].sort()).toEqual(['frankenstein', 'hyakki', 'midas']);
  });
});
