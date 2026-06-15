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
  contactType: 'email' | 'phone';
  contactValue: string;
  passwordHash: string;
  createdAt: string;
  deletedAt: string | null;
  /** True once the player has been granted the 후원자(supporter) badge. */
  supporterBadge: boolean;
  /** When the badge was granted (ISO), or null when not a supporter. */
  supporterBadgeGrantedAt: string | null;
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
    passwordHash: string;
  }): Promise<PlayerRow>;
  getPlayerById(id: string): Promise<PlayerRow | null>;
  /** Active (not soft-deleted) player by nickname, case-insensitive. */
  getPlayerByNickname(nickname: string): Promise<PlayerRow | null>;
  /** Grant or revoke the 후원자(supporter) badge for a player. */
  grantSupporterBadge(
    playerId: string,
    granted: boolean,
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
   * Settle one day's ranking: overwrite each player's daily best_scores row's
   * seasonPoints with the given rank reward (NOT a max), then stamp the
   * daily_challenge's settledAt. Idempotency is the caller's job (settledAt gate).
   */
  settleDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    settledAt: string;
    rewards: Array<{ playerId: string; seasonPoints: number }>;
  }): Promise<void>;
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

  /**
   * Guest→account merge: attach a guest's quick runs to a new account. Updates
   * every mode='quick' run with player_id IS NULL and nickname === guestDisplayName,
   * setting player_id + nickname to the account's. Returns the number updated.
   */
  reassignGuestQuickRuns(input: {
    guestDisplayName: string;
    playerId: string;
    nickname: string;
  }): Promise<number>;

  // ── Season 1 WU8: puzzle records ───────────────────────────────────────────
  /** Keep the player's best goals for a puzzle (tiebreak: fewer spins). */
  upsertPuzzleRecord(input: {
    playerId: string;
    seasonId: string;
    puzzleKey: string;
    goalsAchieved: number;
    spinCount: number | null;
    runId: string | null;
  }): Promise<PuzzleRecordRow>;
  listPlayerPuzzleRecords(playerId: string, seasonId: string): Promise<PuzzleRecordRow[]>;
  /** Distribution: goalsAchieved value → number of players, for one puzzle. */
  getPuzzleDistribution(seasonId: string, puzzleKey: string): Promise<Record<number, number>>;

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
}

/** A row in `puzzle_user_records` — best goals achieved per puzzle. */
export type PuzzleRecordRow = {
  id: string;
  playerId: string;
  seasonId: string;
  puzzleKey: string;
  bestGoalsAchieved: number;
  bestSpinCount: number | null;
  bestRunId: string | null;
  updatedAt: string;
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
