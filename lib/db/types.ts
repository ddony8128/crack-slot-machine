import type { RecordedAction } from '@/store/gameStore';
import type { ReplaySpin } from '@/lib/replay';

/** A row in `players` (global whitelist), camelCased for app use. */
export type PlayerRow = {
  id: string;
  nickname: string;
  createdAt: string;
  deletedAt: string | null;
};

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

/** The client's submitted result snapshot (compared against server replay). */
export type ClientResults = {
  spins: ReplaySpin[];
  finalScore: number;
  bestSpinScore: number;
};

/** A row in `game_runs`, camelCased for app use. */
export type RunRow = {
  id: string;
  eventId: string;
  playerId: string | null;
  nickname: string | null;
  seed: string;
  actions: RecordedAction[] | null;
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

/** Fields needed to open a pending run (seed is server-generated). */
export type CreateRunInput = {
  eventId: string;
  playerId: string | null;
  seed: string;
  clientVersion: string;
  rulesetVersion: number;
};

/** Final values written when a run is verified (or rejected). */
export type FinalizeRunInput = {
  nickname: string;
  actions: RecordedAction[];
  clientResults: ClientResults;
  score: number | null;
  bestSpinScore: number | null;
  status: RunStatus;
  verified: boolean;
  rejectReason: string | null;
  submittedAt: string;
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

  // ── players whitelist (BLACKHAVEN) ─────────────────────────────────────────
  /** All players; active only unless includeDeleted is set. Newest first. */
  listPlayers(opts?: { includeDeleted?: boolean }): Promise<PlayerRow[]>;
  /** The single ACTIVE player matching nickname (case-insensitive), or null. */
  getActivePlayerByNickname(nickname: string): Promise<PlayerRow | null>;
  /** Register a nickname. Throws if an active row with that nickname exists. */
  createPlayer(nickname: string): Promise<PlayerRow>;
  /** Soft delete (set deleted_at). Returns the updated row or null if missing. */
  softDeletePlayer(id: string): Promise<PlayerRow | null>;
  /** Restore a soft-deleted player (clear deleted_at). Null if missing. */
  restorePlayer(id: string): Promise<PlayerRow | null>;

  // ── rewards (개인 최고 점수) ────────────────────────────────────────────────
  /**
   * Highest score among this player's submitted+verified runs in the event.
   * null when the player has no qualifying prior run (=> their first play).
   * Call this BEFORE finalizing the current run so it reflects PRIOR plays only.
   */
  getPlayerBestScore(playerId: string, eventId: string): Promise<number | null>;

  /**
   * Nickname-keyed variant of the best-score lookup. Used when identity comes
   * from the shared 8번출구 whitelist (no local player row, so player_id is null).
   * Matching is case-insensitive on the run's stored nickname.
   */
  getPlayerBestScoreByNickname(
    nickname: string,
    eventId: string,
  ): Promise<number | null>;

  // ── 반복 플레이 패널티 (슬롯 자체 DB) ───────────────────────────────────────
  /**
   * This nickname's most recent submitted+verified plays as {start, end} spans
   * (created_at / submitted_at), newest first. Used to measure the idle gap
   * BETWEEN consecutive plays for the rapid-replay penalty.
   */
  getRecentSubmittedSpans(
    nickname: string,
    eventId: string,
    limit: number,
  ): Promise<{ start: string; end: string }[]>;
  /** Whether a one-time penalty was already recorded for (event, nickname). */
  hasPenalty(nickname: string, eventId: string): Promise<boolean>;
  /** Record the one-time penalty. Idempotent (unique on event+nickname). */
  recordPenalty(nickname: string, eventId: string): Promise<void>;

  /**
   * Leaderboard for `slug`, or the combined all-events board when slug==='total'.
   * Only status='submitted', verified=true, and matching versions are included.
   *
   * When `allowedNicknames` is provided (lowercased), only runs whose nickname is
   * in that set are shown — the shared 8번출구 whitelist filter. Passing it makes
   * the board empty out automatically when the 8번출구 session is reset.
   */
  listLeaderboard(input: {
    slug: string;
    page: number;
    pageSize: number;
    clientVersion: string;
    rulesetVersion: number;
    allowedNicknames?: string[] | null;
  }): Promise<LeaderboardPage>;
}

export const TOTAL_SLUG = 'total';
