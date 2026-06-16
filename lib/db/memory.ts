import type {
  Db,
  EventRow,
  RunRow,
  CreateRunInput,
  FinalizeRunInput,
  LeaderboardItem,
  LeaderboardPage,
  PlayerRow,
  SeasonRow,
  DailyChallengeRow,
  DailyUserStatusRow,
  BestScoreRow,
  PuzzleRecordRow,
  SpireRecordRow,
  SeasonScoreRow,
  ScoreEventRow,
  RunMode,
  RunStatus,
} from '@/lib/db/types';
import { TOTAL_SLUG } from '@/lib/db/types';

/** Seed events mirroring supabase/migrations/0001_init.sql. */
function seedEvents(): EventRow[] {
  const now = new Date().toISOString();
  return [
    { id: 'evt-total', slug: 'total', title: 'Total Ranking', description: null, isActive: true, createdAt: now, disabledAt: null },
    { id: 'evt-blackhaven', slug: 'blackhaven', title: 'Blackhaven Ranking', description: null, isActive: true, createdAt: now, disabledAt: null },
    { id: 'evt-test', slug: 'test', title: 'Test Ranking', description: null, isActive: false, createdAt: now, disabledAt: now },
  ];
}

/** Seed Season 1 mirroring the seed in supabase/migrations/0002_season1.sql. */
function seedSeasons(): SeasonRow[] {
  return [
    {
      id: 'season-1',
      slug: '2026-06-season-1',
      title: 'RULE SLOT Season 1',
      startsAt: '2026-06-15T03:00:00Z',
      endsAt: '2026-06-28T03:00:00Z',
      clientVersion: '2.0.0',
      rulesetVersion: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

type QuickEntry = {
  nickname: string;
  score: number;
  bestSpinScore: number;
  submittedAt: string;
};

/** Quick ranking order: score desc, then bestSpinScore desc, then submittedAt asc. */
function quickBetter(a: QuickEntry, b: QuickEntry): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.bestSpinScore !== b.bestSpinScore) return a.bestSpinScore > b.bestSpinScore;
  return a.submittedAt < b.submittedAt;
}

/**
 * In-memory Db for tests and local dev without Supabase credentials. Replicates
 * the SQL filtering/sorting semantics. Not persistent across process restarts.
 */
export class MemoryDb implements Db {
  private events: EventRow[];
  private runs: RunRow[] = [];
  private players: PlayerRow[] = [];
  private seasons: SeasonRow[];
  private dailyChallenges: DailyChallengeRow[] = [];
  private dailyUserStatuses: DailyUserStatusRow[] = [];
  private bestScores: BestScoreRow[] = [];
  private puzzleRecords: PuzzleRecordRow[] = [];
  private spireRecords: SpireRecordRow[] = [];
  private seasonScores: SeasonScoreRow[] = [];
  private scoreEvents: ScoreEventRow[] = [];
  private counter = 0;

  constructor(events?: EventRow[]) {
    this.events = events ?? seedEvents();
    this.seasons = seedSeasons();
  }

  private id(prefix: string): string {
    this.counter += 1;
    return `${prefix}-${this.counter}`;
  }

  async getEventBySlug(slug: string): Promise<EventRow | null> {
    return this.events.find((e) => e.slug === slug) ?? null;
  }

  async getEventById(id: string): Promise<EventRow | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async listEvents(): Promise<EventRow[]> {
    return [...this.events].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async createEvent(input: {
    slug: string;
    title: string;
    description?: string | null;
  }): Promise<EventRow> {
    if (this.events.some((e) => e.slug === input.slug)) {
      throw new Error(`event slug already exists: ${input.slug}`);
    }
    const row: EventRow = {
      id: this.id('evt'),
      slug: input.slug,
      title: input.title,
      description: input.description ?? null,
      isActive: true,
      createdAt: new Date().toISOString(),
      disabledAt: null,
    };
    this.events.push(row);
    return row;
  }

  async setEventActive(slug: string, active: boolean): Promise<EventRow | null> {
    const row = this.events.find((e) => e.slug === slug);
    if (!row) return null;
    row.isActive = active;
    row.disabledAt = active ? null : new Date().toISOString();
    return row;
  }

  async updateEvent(
    slug: string,
    input: { title?: string; description?: string | null },
  ): Promise<EventRow | null> {
    const row = this.events.find((e) => e.slug === slug);
    if (!row) return null;
    if (input.title !== undefined) row.title = input.title;
    if (input.description !== undefined) row.description = input.description;
    return row;
  }

  async createRun(input: CreateRunInput): Promise<RunRow> {
    const row: RunRow = {
      id: this.id('run'),
      eventId: input.eventId ?? null,
      playerId: input.playerId ?? null,
      seasonId: input.seasonId ?? null,
      mode: input.mode ?? 'event',
      dailyDateKey: input.dailyDateKey ?? null,
      puzzleKey: input.puzzleKey ?? null,
      stageIndex: input.stageIndex ?? null,
      cleared: null,
      clearedStageCount: null,
      seasonPoints: null,
      nickname: null,
      seed: input.seed,
      actions: null,
      clientResults: null,
      score: null,
      bestSpinScore: null,
      clientVersion: input.clientVersion,
      rulesetVersion: input.rulesetVersion,
      status: 'pending',
      verified: false,
      rejectReason: null,
      createdAt: new Date().toISOString(),
      submittedAt: null,
    };
    this.runs.push(row);
    return row;
  }

  async getRun(runId: string): Promise<RunRow | null> {
    return this.runs.find((r) => r.id === runId) ?? null;
  }

  async finalizeRun(
    runId: string,
    input: FinalizeRunInput,
  ): Promise<RunRow | null> {
    const row = this.runs.find((r) => r.id === runId);
    if (!row) return null;
    row.nickname = input.nickname;
    row.actions = input.actions;
    row.clientResults = input.clientResults;
    row.score = input.score;
    row.bestSpinScore = input.bestSpinScore;
    row.status = input.status;
    row.verified = input.verified;
    row.rejectReason = input.rejectReason;
    row.submittedAt = input.submittedAt;
    row.cleared = input.cleared ?? null;
    row.clearedStageCount = input.clearedStageCount ?? null;
    row.seasonPoints = input.seasonPoints ?? null;
    return row;
  }

  async invalidateRun(runId: string, reason: string): Promise<void> {
    const row = this.runs.find((r) => r.id === runId);
    if (!row) return;
    row.status = 'rejected';
    row.rejectReason = reason;
    row.verified = false;
  }

  async listRecentRuns(input: {
    mode?: RunMode;
    seasonId?: string;
    status?: RunStatus;
    limit?: number;
  }): Promise<RunRow[]> {
    const rows = this.runs.filter(
      (r) =>
        (input.mode === undefined || r.mode === input.mode) &&
        (input.seasonId === undefined || r.seasonId === input.seasonId) &&
        (input.status === undefined || r.status === input.status),
    );
    // Newest first by submittedAt, with createdAt as the fallback when null.
    rows.sort((a, b) => {
      const ak = a.submittedAt ?? a.createdAt;
      const bk = b.submittedAt ?? b.createdAt;
      return ak < bk ? 1 : ak > bk ? -1 : 0;
    });
    return rows.slice(0, input.limit ?? 50);
  }

  async listLeaderboard(input: {
    slug: string;
    page: number;
    pageSize: number;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<LeaderboardPage> {
    const { slug, page, pageSize, clientVersion, rulesetVersion } = input;
    const eventBySlug = new Map(this.events.map((e) => [e.id, e]));

    let rows = this.runs.filter(
      (r) =>
        r.status === 'submitted' &&
        r.verified &&
        r.clientVersion === clientVersion &&
        r.rulesetVersion === rulesetVersion,
    );

    if (slug !== TOTAL_SLUG) {
      const event = this.events.find((e) => e.slug === slug);
      if (!event) return { page, pageSize, totalCount: 0, items: [] };
      rows = rows.filter((r) => r.eventId === event.id);
    }

    rows.sort((a, b) => {
      if ((b.score ?? 0) !== (a.score ?? 0)) return (b.score ?? 0) - (a.score ?? 0);
      if ((b.bestSpinScore ?? 0) !== (a.bestSpinScore ?? 0))
        return (b.bestSpinScore ?? 0) - (a.bestSpinScore ?? 0);
      const as = a.submittedAt ?? '';
      const bs = b.submittedAt ?? '';
      return as < bs ? -1 : as > bs ? 1 : 0;
    });

    const totalCount = rows.length;
    const start = (page - 1) * pageSize;
    const items: LeaderboardItem[] = rows
      .slice(start, start + pageSize)
      .map((r, i) => ({
        rank: start + i + 1,
        nickname: r.nickname ?? 'Anonymous',
        score: r.score ?? 0,
        bestSpinScore: r.bestSpinScore ?? 0,
        submittedAt: r.submittedAt ?? '',
        eventSlug: (r.eventId ? eventBySlug.get(r.eventId) : undefined)?.slug ?? '',
      }));

    return { page, pageSize, totalCount, items };
  }

  // ── Season 1: accounts ─────────────────────────────────────────────────────
  async createPlayer(input: {
    nickname: string;
    contactType: 'email' | 'phone';
    contactValue: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
  }): Promise<PlayerRow> {
    const row: PlayerRow = {
      id: this.id('player'),
      nickname: input.nickname,
      contactType: input.contactType,
      contactValue: input.contactValue,
      email: input.email ?? null,
      phone: input.phone ?? null,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      deletedAt: null,
      supporterBadge: false,
      supporterBadgeGrantedAt: null,
      supporterNote: null,
    };
    this.players.push(row);
    return row;
  }

  async getPlayerById(id: string): Promise<PlayerRow | null> {
    return this.players.find((p) => p.id === id) ?? null;
  }

  async getPlayerByNickname(nickname: string): Promise<PlayerRow | null> {
    const lower = nickname.toLowerCase();
    return (
      this.players.find(
        (p) => p.deletedAt === null && p.nickname.toLowerCase() === lower,
      ) ?? null
    );
  }

  async getPlayerByEmail(email: string): Promise<PlayerRow | null> {
    const lower = email.toLowerCase();
    return (
      this.players.find(
        (p) =>
          p.deletedAt === null &&
          p.email !== null &&
          p.email.toLowerCase() === lower,
      ) ?? null
    );
  }

  async getPlayerByPhone(phone: string): Promise<PlayerRow | null> {
    return (
      this.players.find(
        (p) => p.deletedAt === null && p.phone !== null && p.phone === phone,
      ) ?? null
    );
  }

  async grantSupporterBadge(
    playerId: string,
    granted: boolean,
    note?: string | null,
  ): Promise<PlayerRow | null> {
    const row = this.players.find((p) => p.id === playerId);
    if (!row) return null;
    row.supporterBadge = granted;
    // MemoryDb has no clock for deterministic tests; use a fixed sentinel when
    // granted so the column is non-null, and clear it when revoked.
    row.supporterBadgeGrantedAt = granted
      ? (row.supporterBadgeGrantedAt ?? new Date(0).toISOString())
      : null;
    // Store the note on grant (keep existing when omitted); clear on revoke.
    if (granted) {
      if (note !== undefined) row.supporterNote = note;
    } else {
      row.supporterNote = null;
    }
    return row;
  }

  async updatePlayerPassword(
    playerId: string,
    passwordHash: string,
  ): Promise<void> {
    const row = this.players.find((p) => p.id === playerId);
    if (row) row.passwordHash = passwordHash;
  }

  async deactivatePlayer(playerId: string): Promise<void> {
    const row = this.players.find((p) => p.id === playerId);
    if (!row) return;
    // MemoryDb has no clock; use a fixed sentinel so deletedAt is non-null and
    // tests stay deterministic.
    row.deletedAt = new Date(0).toISOString();
    row.contactValue = '';
    row.email = null;
    row.phone = null;
    // Anonymize so leaderboards (which resolve via getPlayerById) show no PII.
    row.nickname = `탈퇴회원${playerId.slice(0, 6)}`;
  }

  // ── Season 1: seasons ──────────────────────────────────────────────────────
  async getSeasonBySlug(slug: string): Promise<SeasonRow | null> {
    return this.seasons.find((s) => s.slug === slug) ?? null;
  }

  async getActiveSeason(): Promise<SeasonRow | null> {
    const active = this.seasons.filter((s) => s.isActive);
    if (active.length === 0) return null;
    active.sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
    return active[0];
  }

  // ── Season 1: daily challenges ─────────────────────────────────────────────
  async getDailyChallenge(
    seasonId: string,
    dateKey: string,
  ): Promise<DailyChallengeRow | null> {
    return (
      this.dailyChallenges.find(
        (d) => d.seasonId === seasonId && d.dateKey === dateKey,
      ) ?? null
    );
  }

  async upsertDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    startsAt: string;
    endsAt: string;
    seed: string;
    groupASetId: string;
    groupBSetId: string;
    config?: unknown;
  }): Promise<DailyChallengeRow> {
    // Re-upsert is a no-op on an existing row (the /api/daily/current route
    // upserts on every load) — crucially this PRESERVES settled_at.
    const existing = await this.getDailyChallenge(input.seasonId, input.dateKey);
    if (existing) return existing;
    const row: DailyChallengeRow = {
      id: this.id('daily'),
      seasonId: input.seasonId,
      dateKey: input.dateKey,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      seed: input.seed,
      groupASetId: input.groupASetId,
      groupBSetId: input.groupBSetId,
      config: input.config ?? null,
      createdAt: new Date().toISOString(),
      settledAt: null,
    };
    this.dailyChallenges.push(row);
    return row;
  }

  async listSeasonDailyChallenges(seasonId: string): Promise<DailyChallengeRow[]> {
    return this.dailyChallenges.filter((d) => d.seasonId === seasonId);
  }

  async settleDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    settledAt: string;
    rewards: Array<{ playerId: string; seasonPoints: number }>;
  }): Promise<void> {
    for (const reward of input.rewards) {
      const row = this.bestScores.find(
        (b) =>
          b.playerId === reward.playerId &&
          b.seasonId === input.seasonId &&
          b.mode === 'daily' &&
          b.scopeKey === input.dateKey,
      );
      // Overwrite (not max) with this day's settled rank reward.
      if (row) row.seasonPoints = reward.seasonPoints;
    }
    const challenge = this.dailyChallenges.find(
      (d) => d.seasonId === input.seasonId && d.dateKey === input.dateKey,
    );
    if (challenge) challenge.settledAt = input.settledAt;
  }

  async countResolvedDailyRuns(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<number> {
    return this.runs.filter(
      (r) =>
        r.playerId === input.playerId &&
        r.seasonId === input.seasonId &&
        r.mode === 'daily' &&
        r.dailyDateKey === input.dateKey &&
        (r.status === 'submitted' || r.status === 'rejected'),
    ).length;
  }

  async getDailyUserStatus(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow | null> {
    return (
      this.dailyUserStatuses.find(
        (s) =>
          s.playerId === input.playerId &&
          s.seasonId === input.seasonId &&
          s.dateKey === input.dateKey,
      ) ?? null
    );
  }

  async setDailyAdRefillUsed(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow> {
    const existing = await this.getDailyUserStatus(input);
    if (existing) {
      existing.adRefillUsed = true;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
    const row: DailyUserStatusRow = {
      id: this.id('daily-status'),
      playerId: input.playerId,
      seasonId: input.seasonId,
      dateKey: input.dateKey,
      adRefillUsed: true,
      updatedAt: new Date().toISOString(),
    };
    this.dailyUserStatuses.push(row);
    return row;
  }

  // ── Season 1: best scores / ranking ────────────────────────────────────────
  async upsertBestScore(input: {
    playerId: string;
    seasonId: string;
    mode: RunMode;
    scopeKey: string;
    score: number;
    seasonPoints: number;
    cleared?: boolean | null;
    runId: string | null;
  }): Promise<BestScoreRow> {
    const existing = this.bestScores.find(
      (b) =>
        b.playerId === input.playerId &&
        b.seasonId === input.seasonId &&
        b.mode === input.mode &&
        b.scopeKey === input.scopeKey,
    );
    if (!existing) {
      const row: BestScoreRow = {
        id: this.id('best'),
        playerId: input.playerId,
        seasonId: input.seasonId,
        mode: input.mode,
        scopeKey: input.scopeKey,
        score: input.score,
        seasonPoints: input.seasonPoints,
        cleared: !!input.cleared,
        runId: input.runId,
        updatedAt: new Date().toISOString(),
      };
      this.bestScores.push(row);
      return row;
    }
    if (input.score > existing.score) {
      existing.score = input.score;
      existing.seasonPoints = input.seasonPoints;
      existing.runId = input.runId;
      existing.updatedAt = new Date().toISOString();
    }
    existing.cleared = !!existing.cleared || !!input.cleared;
    return existing;
  }

  async listPlayerBestScores(
    playerId: string,
    seasonId: string,
  ): Promise<BestScoreRow[]> {
    return this.bestScores.filter(
      (b) => b.playerId === playerId && b.seasonId === seasonId,
    );
  }

  async listSeasonBestScores(seasonId: string): Promise<BestScoreRow[]> {
    return this.bestScores.filter((b) => b.seasonId === seasonId);
  }

  async listDailyBestScores(
    seasonId: string,
    dateKey: string,
  ): Promise<BestScoreRow[]> {
    return this.bestScores
      .filter(
        (b) =>
          b.seasonId === seasonId &&
          b.mode === 'daily' &&
          b.scopeKey === dateKey,
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
      });
  }

  // ── Quick game (guest + member) ranking ────────────────────────────────────
  async listQuickBestScores(input: {
    seasonId: string | null;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<
    Array<{ nickname: string; score: number; bestSpinScore: number; submittedAt: string }>
  > {
    const rows = this.runs.filter(
      (r) =>
        r.mode === 'quick' &&
        r.status === 'submitted' &&
        r.verified &&
        r.seasonId === input.seasonId &&
        r.clientVersion === input.clientVersion &&
        r.rulesetVersion === input.rulesetVersion,
    );

    // Dedupe by nickname, keeping the best:
    // score desc, then bestSpinScore desc, then submittedAt asc.
    const best = new Map<
      string,
      { nickname: string; score: number; bestSpinScore: number; submittedAt: string }
    >();
    for (const r of rows) {
      const nickname = r.nickname ?? 'Anonymous';
      const candidate = {
        nickname,
        score: r.score ?? 0,
        bestSpinScore: r.bestSpinScore ?? 0,
        submittedAt: r.submittedAt ?? '',
      };
      const current = best.get(nickname);
      if (!current || quickBetter(candidate, current)) {
        best.set(nickname, candidate);
      }
    }

    return [...best.values()].sort((a, b) => (quickBetter(a, b) ? -1 : quickBetter(b, a) ? 1 : 0));
  }

  async reassignGuestQuickRuns(input: {
    guestDisplayName: string;
    playerId: string;
    nickname: string;
  }): Promise<number> {
    let count = 0;
    for (const r of this.runs) {
      if (
        r.mode === 'quick' &&
        r.playerId === null &&
        r.nickname === input.guestDisplayName
      ) {
        r.playerId = input.playerId;
        r.nickname = input.nickname;
        count += 1;
      }
    }
    return count;
  }

  // ── Season 1 WU8: puzzle records ───────────────────────────────────────────
  async upsertPuzzleRecord(input: {
    playerId: string;
    seasonId: string;
    puzzleKey: string;
    goalsAchieved: number;
    spinCount: number | null;
    runId: string | null;
  }): Promise<PuzzleRecordRow> {
    const existing = this.puzzleRecords.find(
      (p) =>
        p.playerId === input.playerId &&
        p.seasonId === input.seasonId &&
        p.puzzleKey === input.puzzleKey,
    );
    if (!existing) {
      const row: PuzzleRecordRow = {
        id: this.id('puzzle-rec'),
        playerId: input.playerId,
        seasonId: input.seasonId,
        puzzleKey: input.puzzleKey,
        bestGoalsAchieved: input.goalsAchieved,
        bestSpinCount: input.spinCount,
        bestRunId: input.runId,
        updatedAt: new Date().toISOString(),
      };
      this.puzzleRecords.push(row);
      return row;
    }
    const better =
      input.goalsAchieved > existing.bestGoalsAchieved ||
      (input.goalsAchieved === existing.bestGoalsAchieved &&
        input.spinCount !== null &&
        (existing.bestSpinCount === null ||
          input.spinCount < existing.bestSpinCount));
    if (better) {
      existing.bestGoalsAchieved = input.goalsAchieved;
      existing.bestSpinCount = input.spinCount;
      existing.bestRunId = input.runId;
      existing.updatedAt = new Date().toISOString();
    }
    return existing;
  }

  async listPlayerPuzzleRecords(
    playerId: string,
    seasonId: string,
  ): Promise<PuzzleRecordRow[]> {
    return this.puzzleRecords.filter(
      (p) => p.playerId === playerId && p.seasonId === seasonId,
    );
  }

  async getPuzzleDistribution(
    seasonId: string,
    puzzleKey: string,
  ): Promise<Record<number, number>> {
    const dist: Record<number, number> = {};
    for (const p of this.puzzleRecords) {
      if (p.seasonId !== seasonId || p.puzzleKey !== puzzleKey) continue;
      dist[p.bestGoalsAchieved] = (dist[p.bestGoalsAchieved] ?? 0) + 1;
    }
    return dist;
  }

  // ── Season 1 WU9: spire records ────────────────────────────────────────────
  async upsertSpireRecord(input: {
    playerId: string;
    seasonId: string;
    stageReached: number;
    totalScore: number;
    runId: string | null;
  }): Promise<SpireRecordRow> {
    const existing = this.spireRecords.find(
      (s) => s.playerId === input.playerId && s.seasonId === input.seasonId,
    );
    if (!existing) {
      const row: SpireRecordRow = {
        id: this.id('spire-rec'),
        playerId: input.playerId,
        seasonId: input.seasonId,
        bestStageReached: input.stageReached,
        bestTotalScore: input.totalScore,
        bestRunId: input.runId,
        updatedAt: new Date().toISOString(),
      };
      this.spireRecords.push(row);
      return row;
    }
    const better =
      input.stageReached > existing.bestStageReached ||
      (input.stageReached === existing.bestStageReached &&
        input.totalScore > existing.bestTotalScore);
    if (better) {
      existing.bestStageReached = input.stageReached;
      existing.bestTotalScore = input.totalScore;
      existing.bestRunId = input.runId;
      existing.updatedAt = new Date().toISOString();
    }
    return existing;
  }

  async getSpireRecord(
    playerId: string,
    seasonId: string,
  ): Promise<SpireRecordRow | null> {
    return (
      this.spireRecords.find(
        (s) => s.playerId === playerId && s.seasonId === seasonId,
      ) ?? null
    );
  }

  async listSpireRecords(seasonId: string): Promise<SpireRecordRow[]> {
    return this.spireRecords.filter((s) => s.seasonId === seasonId);
  }

  // ── §6 season-score ledger ─────────────────────────────────────────────────
  async upsertSeasonScore(input: {
    playerId: string;
    seasonId: string;
    puzzleScore: number;
    dailyScore: number;
    spireScore: number;
    totalScore: number;
  }): Promise<void> {
    const existing = this.seasonScores.find(
      (s) => s.playerId === input.playerId && s.seasonId === input.seasonId,
    );
    // MemoryDb has no clock; use a fixed sentinel so updatedAt is non-null and
    // tests stay deterministic (they only assert the score values).
    const updatedAt = new Date(0).toISOString();
    if (existing) {
      existing.puzzleScore = input.puzzleScore;
      existing.dailyScore = input.dailyScore;
      existing.spireScore = input.spireScore;
      existing.totalScore = input.totalScore;
      existing.updatedAt = updatedAt;
      return;
    }
    this.seasonScores.push({ ...input, updatedAt });
  }

  async insertScoreEvent(input: {
    playerId: string;
    seasonId: string;
    sourceType: string;
    sourceId?: string | null;
    previousTotalScore: number;
    newTotalScore: number;
    delta: number;
    previousRank: number | null;
    newRank: number | null;
  }): Promise<ScoreEventRow> {
    const row: ScoreEventRow = {
      id: this.id('score-event'),
      playerId: input.playerId,
      seasonId: input.seasonId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      previousTotalScore: input.previousTotalScore,
      newTotalScore: input.newTotalScore,
      delta: input.delta,
      previousRank: input.previousRank,
      newRank: input.newRank,
      // Fixed sentinel (no clock); newest-first ordering uses insertion order.
      createdAt: new Date(0).toISOString(),
    };
    this.scoreEvents.push(row);
    return row;
  }

  async listScoreEvents(
    playerId: string,
    seasonId: string,
    limit = 50,
  ): Promise<ScoreEventRow[]> {
    // Newest first: createdAt has no clock, so reverse insertion order stands in.
    return this.scoreEvents
      .filter((e) => e.playerId === playerId && e.seasonId === seasonId)
      .slice()
      .reverse()
      .slice(0, limit);
  }
}
