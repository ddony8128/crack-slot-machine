import type { RecordedAction } from '@/store/gameStore';
import type { ReplaySpin } from '@/lib/replay';

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
}

export const TOTAL_SLUG = 'total';
