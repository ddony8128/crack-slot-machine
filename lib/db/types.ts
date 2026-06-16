import type { RecordedAction } from '@/store/gameStore';
import type { ReplaySpin } from '@/lib/replay';
import type { SpireAction } from '@/lib/spire/replay';

/**
 * Actions persisted on a run. Most modes record the per-spin RecordedAction[];
 * 첨탑 v0 records the higher-level SpireAction[] (which wraps per-stage
 * RecordedAction[]). Stored as JSON, so the union is just the API-boundary type.
 */
export type PersistedActions = RecordedAction[] | SpireAction[];

/** A row in `events`, camelCased for app use. */
export type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  disabledAt: string | null;
};

export type RunStatus = 'pending' | 'submitted' | 'rejected';

/** Which game mode a run belongs to. 'event' is the legacy per-event flow. */
export type RunMode = 'event' | 'daily' | 'puzzle' | 'spire' | 'quick';

/** A row in `players` (Season 1 accounts), camelCased. */
export type PlayerRow = {
  id: string;
  nickname: string;
  /** Primary contact kind for back-compat reads (email when present, else phone). */
  contactType: 'email' | 'phone';
  /** Primary contact value for back-compat reads (email when present, else phone). */
  contactValue: string;
  /** Optional email (nullable). At least one of email/phone is set at signup. */
  email: string | null;
  /** Optional phone (nullable). At least one of email/phone is set at signup. */
  phone: string | null;
  passwordHash: string;
  createdAt: string;
  deletedAt: string | null;
  /** True once the player has been granted the 후원자(supporter) badge. */
  supporterBadge: boolean;
  /** When the badge was granted (ISO), or null when not a supporter. */
  supporterBadgeGrantedAt: string | null;
  /** Admin 후원 메모 (입금일/금액/입금자명 등), or null. */
  supporterNote: string | null;
};

/** A row in `seasons`. */
export type SeasonRow = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt: string;
  clientVersion: string;
  rulesetVersion: number;
  isActive: boolean;
  createdAt: string;
};

/** A row in `daily_challenges`. */
export type DailyChallengeRow = {
  id: string;
  seasonId: string;
  dateKey: string;
  startsAt: string;
  endsAt: string;
  seed: string;
  groupASetId: string;
  groupBSetId: string;
  config: unknown | null;
  createdAt: string;
  /** When this day's ranking was settled (rank rewards persisted), or null. */
  settledAt: string | null;
};

/** A row in `daily_user_status` — per-day ad-refill flag for a player. */
export type DailyUserStatusRow = {
  id: string;
  playerId: string;
  seasonId: string;
  dateKey: string;
  adRefillUsed: boolean;
  updatedAt: string;
};

/** A row in `best_scores` — the ranking source of truth (one per scope). */
export type BestScoreRow = {
  id: string;
  playerId: string;
  seasonId: string;
  mode: RunMode;
  scopeKey: string;
  score: number;
  seasonPoints: number;
  cleared: boolean | null;
  runId: string | null;
  updatedAt: string;
};

/** The client's submitted result snapshot (compared against server replay). */
export type ClientResults = {
  spins: ReplaySpin[];
  finalScore: number;
  bestSpinScore: number;
};

/** A row in `game_runs`, camelCased for app use. */
export type RunRow = {
  id: string;
  eventId: string | null;
  playerId: string | null;
  seasonId: string | null;
  mode: RunMode;
  dailyDateKey: string | null;
  puzzleKey: string | null;
  stageIndex: number | null;
  cleared: boolean | null;
  clearedStageCount: number | null;
  seasonPoints: number | null;
  nickname: string | null;
  seed: string;
  actions: PersistedActions | null;
  clientResults: ClientResults | null;
  score: number | null;
  bestSpinScore: number | null;
  clientVersion: string;
  rulesetVersion: number;
  status: RunStatus;
  verified: boolean;
  rejectReason: string | null;
  createdAt: string;
  submittedAt: string | null;
};

export type LeaderboardItem = {
  rank: number;
  nickname: string;
  score: number;
  bestSpinScore: number;
  submittedAt: string;
  eventSlug: string;
};

export type LeaderboardPage = {
  page: number;
  pageSize: number;
  totalCount: number;
  items: LeaderboardItem[];
};

/**
 * Fields needed to open a pending run (seed is server-generated). `eventId` is
 * used by the legacy event flow; season modes pass `playerId`/`seasonId`/`mode`
 * (+ the mode's scope key) instead.
 */
export type CreateRunInput = {
  eventId?: string | null;
  playerId?: string | null;
  seasonId?: string | null;
  mode?: RunMode;
  dailyDateKey?: string | null;
  puzzleKey?: string | null;
  stageIndex?: number | null;
  seed: string;
  clientVersion: string;
  rulesetVersion: number;
};

/** Final values written when a run is verified (or rejected). */
export type FinalizeRunInput = {
  nickname: string;
  actions: PersistedActions;
  clientResults: ClientResults;
  score: number | null;
  bestSpinScore: number | null;
  status: RunStatus;
  verified: boolean;
  rejectReason: string | null;
  submittedAt: string;
  // Season-mode extras (optional; ignored by the event flow).
  cleared?: boolean | null;
  clearedStageCount?: number | null;
  seasonPoints?: number | null;
};

/**
 * Storage-agnostic data access. The Supabase implementation backs production;
 * the in-memory implementation backs tests and local dev without credentials.
 */
export interface Db {
  getEventBySlug(slug: string): Promise<EventRow | null>;
  getEventById(id: string): Promise<EventRow | null>;
  listEvents(): Promise<EventRow[]>;
  createEvent(input: {
    slug: string;
    title: string;
    description?: string | null;
  }): Promise<EventRow>;
  setEventActive(slug: string, active: boolean): Promise<EventRow | null>;
  updateEvent(
    slug: string,
    input: { title?: string; description?: string | null },
  ): Promise<EventRow | null>;

  createRun(input: CreateRunInput): Promise<RunRow>;
  getRun(runId: string): Promise<RunRow | null>;
  finalizeRun(runId: string, input: FinalizeRunInput): Promise<RunRow | null>;
  /**
   * Admin invalidation: mark a run rejected with the given reason and clear its
   * verified flag. Does NOT recompute best_scores (a future cleanup pass owns
   * that) — rankings read from best_scores, so the run row alone is updated.
   */
  invalidateRun(runId: string, reason: string): Promise<void>;

  /**
   * Recent runs for admin balance tuning, newest first (submittedAt DESC, with
   * createdAt as the fallback when submittedAt is null). Each provided field
   * narrows the result; omitted fields are not filtered. Capped at `limit ?? 50`.
   */
  listRecentRuns(input: {
    mode?: RunMode;
    seasonId?: string;
    status?: RunStatus;
    limit?: number;
  }): Promise<RunRow[]>;

  /**
   * Leaderboard for `slug`, or the combined all-events board when slug==='total'.
   * Only status='submitted', verified=true, and matching versions are included.
   */
  listLeaderboard(input: {
    slug: string;
    page: number;
    pageSize: number;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<LeaderboardPage>;

  // ── Season 1: accounts ─────────────────────────────────────────────────────
  createPlayer(input: {
    nickname: string;
    contactType: 'email' | 'phone';
    contactValue: string;
    email?: string | null;
    phone?: string | null;
    passwordHash: string;
  }): Promise<PlayerRow>;
  getPlayerById(id: string): Promise<PlayerRow | null>;
  /** Active (not soft-deleted) player by nickname, case-insensitive. */
  getPlayerByNickname(nickname: string): Promise<PlayerRow | null>;
  /** Active (not soft-deleted) player by email, case-insensitive. */
  getPlayerByEmail(email: string): Promise<PlayerRow | null>;
  /** Active (not soft-deleted) player by phone. */
  getPlayerByPhone(phone: string): Promise<PlayerRow | null>;
  /** Replace a player's password hash. */
  updatePlayerPassword(playerId: string, passwordHash: string): Promise<void>;
  /**
   * Soft-delete + anonymize a player (탈퇴): set deletedAt, clear contactValue +
   * email + phone, and rename to an anonymized stable value so leaderboards carry
   * no PII. The
   * row is kept (best_scores reference playerId). Frees the nickname + contact
   * for reuse (the active-nickname index only constrains non-deleted rows).
   */
  deactivatePlayer(playerId: string): Promise<void>;
  /** Grant or revoke the 후원자(supporter) badge for a player, with an optional
   *  admin note (stored on grant; cleared on revoke when omitted). */
  grantSupporterBadge(
    playerId: string,
    granted: boolean,
    note?: string | null,
  ): Promise<PlayerRow | null>;

  // ── Season 1: seasons ──────────────────────────────────────────────────────
  getSeasonBySlug(slug: string): Promise<SeasonRow | null>;
  getActiveSeason(): Promise<SeasonRow | null>;

  // ── Season 1: daily challenges ─────────────────────────────────────────────
  getDailyChallenge(seasonId: string, dateKey: string): Promise<DailyChallengeRow | null>;
  /** Idempotent lazy-create of a day's challenge (no cron needed). */
  upsertDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    startsAt: string;
    endsAt: string;
    seed: string;
    groupASetId: string;
    groupBSetId: string;
    config?: unknown;
  }): Promise<DailyChallengeRow>;
  /** Every daily challenge in a season (for the lazy settlement pass). */
  listSeasonDailyChallenges(seasonId: string): Promise<DailyChallengeRow[]>;
  /**
   * Atomically CLAIM and settle one day's ranking. Stamps the daily_challenge's
   * settledAt ONLY if it was still null (a conditional/atomic update), then — and
   * only if this call won the claim — overwrites each player's daily best_scores
   * row's seasonPoints with the rank reward (NOT a max). Returns true iff THIS
   * call performed the settlement; false if the day was already settled (a
   * concurrent pass won). This makes settlement idempotent under concurrency, so
   * the caller records each day's rank-reward ledger rows exactly once.
   */
  settleDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    settledAt: string;
    rewards: Array<{ playerId: string; seasonPoints: number }>;
  }): Promise<boolean>;
  /** Count a player's RESOLVED (submitted|rejected) daily runs for a date. */
  countResolvedDailyRuns(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<number>;
  /** The player's daily status row for a date (ad-refill flag), or null. */
  getDailyUserStatus(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow | null>;
  /** Mark the one-time ad refill used (idempotent upsert). Returns the row. */
  setDailyAdRefillUsed(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow>;

  // ── Season 1: best scores / ranking ────────────────────────────────────────
  /** Insert or update the player's best for a scope IF the new score is higher. */
  upsertBestScore(input: {
    playerId: string;
    seasonId: string;
    mode: RunMode;
    scopeKey: string;
    score: number;
    seasonPoints: number;
    cleared?: boolean | null;
    runId: string | null;
  }): Promise<BestScoreRow>;
  /** All of a player's best_scores rows for a season (for /me + season total). */
  listPlayerBestScores(playerId: string, seasonId: string): Promise<BestScoreRow[]>;
  /** Every best_scores row for a season (caller aggregates the season ranking). */
  listSeasonBestScores(seasonId: string): Promise<BestScoreRow[]>;
  /** Daily ranking for one date: best score per player, highest first. */
  listDailyBestScores(seasonId: string, dateKey: string): Promise<BestScoreRow[]>;

  // ── Quick game (guest + member) ranking ────────────────────────────────────
  /**
   * Fast-game leaderboard: best score per nickname among mode='quick',
   * submitted+verified runs in the season (seasonId null = the no-season bucket),
   * version-gated. NOT part of season points. Highest first.
   */
  listQuickBestScores(input: {
    seasonId: string | null;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<Array<{ nickname: string; score: number; bestSpinScore: number; submittedAt: string }>>;

  // ── Season 1 WU8: puzzle records ───────────────────────────────────────────
  /**
   * Keep the player's best CLEAR for a puzzle. A record only "improves" when the
   * submit is a clear AND (no prior clear, OR fewer clear spins, OR — on a tie —
   * a higher puzzle score). A non-clearing submit creates/keeps an un-cleared
   * row (so the not-cleared distribution bucket counts it) without overwriting an
   * existing clear.
   */
  upsertPuzzleRecord(input: {
    playerId: string;
    seasonId: string;
    puzzleKey: string;
    cleared: boolean;
    clearSpin: number | null;
    remainingSpins: number | null;
    puzzleScore: number | null;
    runId: string | null;
    clearedAt: string | null;
  }): Promise<PuzzleRecordRow>;
  listPlayerPuzzleRecords(playerId: string, seasonId: string): Promise<PuzzleRecordRow[]>;
  /**
   * Clear-spin distribution for one puzzle: how many players' BEST record cleared
   * on each spin count (1..spinLimit), plus how many have a record but have not
   * cleared it.
   */
  getPuzzleDistribution(
    seasonId: string,
    puzzleKey: string,
  ): Promise<PuzzleDistribution>;

  // ── Season 1 WU9: spire records ────────────────────────────────────────────
  /** Keep the player's best spire run (by stage reached, then total score). */
  upsertSpireRecord(input: {
    playerId: string;
    seasonId: string;
    stageReached: number;
    totalScore: number;
    runId: string | null;
  }): Promise<SpireRecordRow>;
  getSpireRecord(playerId: string, seasonId: string): Promise<SpireRecordRow | null>;
  listSpireRecords(seasonId: string): Promise<SpireRecordRow[]>;

  // ── §6 season-score ledger ─────────────────────────────────────────────────
  /** Overwrite a player's cached per-mode + total season score for a season. */
  upsertSeasonScore(input: {
    playerId: string;
    seasonId: string;
    puzzleScore: number;
    dailyScore: number;
    spireScore: number;
    totalScore: number;
  }): Promise<void>;
  /** Append one audit-trail row to the season-score ledger. Returns the row. */
  insertScoreEvent(input: {
    playerId: string;
    seasonId: string;
    sourceType: string;
    sourceId?: string | null;
    previousTotalScore: number;
    newTotalScore: number;
    delta: number;
    previousRank: number | null;
    newRank: number | null;
  }): Promise<ScoreEventRow>;
  /** A player's score events for a season, newest first (default 50). */
  listScoreEvents(
    playerId: string,
    seasonId: string,
    limit?: number,
  ): Promise<ScoreEventRow[]>;
}

/** A row in `puzzle_user_records` — best CLEAR per puzzle (spec §13). */
export type PuzzleRecordRow = {
  id: string;
  playerId: string;
  seasonId: string;
  puzzleKey: string;
  /** True once the player has cleared this puzzle at least once. */
  cleared: boolean;
  /** Fewest spins used on a clear, or null when never cleared. */
  bestClearSpin: number | null;
  /** Leftover spins (spinLimit − clearSpin) on the best clear, or null. */
  bestRemainingSpins: number | null;
  /** Highest puzzle score (100 + leftover×10) on the best clear, or null. */
  bestPuzzleScore: number | null;
  bestRunId: string | null;
  /** When the best clear happened (ISO), or null when never cleared. */
  clearedAt: string | null;
  updatedAt: string;
};

/**
 * Clear-spin distribution for one puzzle: `bySpin[n]` = number of players whose
 * best record cleared on exactly n spins; `notCleared` = players with a record
 * that has never been cleared.
 */
export type PuzzleDistribution = {
  bySpin: Record<number, number>;
  notCleared: number;
};

/** A row in `spire_user_records` — best stage + score per player. */
export type SpireRecordRow = {
  id: string;
  playerId: string;
  seasonId: string;
  bestStageReached: number;
  bestTotalScore: number;
  bestRunId: string | null;
  updatedAt: string;
};

/** A row in `season_scores` — the cached per-mode + total season score. */
export type SeasonScoreRow = {
  playerId: string;
  seasonId: string;
  puzzleScore: number;
  dailyScore: number;
  spireScore: number;
  totalScore: number;
  updatedAt: string;
};

/** A row in `score_events` — one audit-trail entry for a season-points change. */
export type ScoreEventRow = {
  id: string;
  playerId: string;
  seasonId: string;
  sourceType: string;
  sourceId: string | null;
  previousTotalScore: number;
  newTotalScore: number;
  delta: number;
  previousRank: number | null;
  newRank: number | null;
  createdAt: string;
};

/** One row of a season-points ranking (nickname resolved). */
export type SeasonRankItem = {
  rank: number;
  playerId: string;
  nickname: string;
  seasonPoints: number;
  spirePoints: number;
  puzzlePoints: number;
  dailyPoints: number;
};

/** One row of a daily ranking. */
export type DailyRankItem = {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
};

export const TOTAL_SLUG = 'total';
