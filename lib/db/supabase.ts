import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type {
  Db,
  EventRow,
  RunRow,
  RunStatus,
  CreateRunInput,
  FinalizeRunInput,
  LeaderboardItem,
  LeaderboardPage,
  ClientResults,
  PlayerRow,
  SeasonRow,
  DailyChallengeRow,
  DailyUserStatusRow,
  BestScoreRow,
  PuzzleRecordRow,
  PuzzleDistribution,
  SpireRecordRow,
  ScoreEventRow,
  RunMode,
} from '@/lib/db/types';
import { TOTAL_SLUG } from '@/lib/db/types';
import type { RecordedAction } from '@/store/gameStore';

/* eslint-disable @typescript-eslint/no-explicit-any */

function toEvent(row: any): EventRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    disabledAt: row.disabled_at ?? null,
  };
}

function toRun(row: any): RunRow {
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    playerId: row.player_id ?? null,
    seasonId: row.season_id ?? null,
    mode: row.mode as RunMode,
    dailyDateKey: row.daily_date_key ?? null,
    puzzleKey: row.puzzle_key ?? null,
    stageIndex: row.stage_index ?? null,
    cleared: row.cleared ?? null,
    clearedStageCount: row.cleared_stage_count ?? null,
    seasonPoints: row.season_points ?? null,
    nickname: row.nickname ?? null,
    seed: row.seed,
    actions: (row.actions ?? null) as RecordedAction[] | null,
    clientResults: (row.client_results ?? null) as ClientResults | null,
    score: row.score ?? null,
    bestSpinScore: row.best_spin_score ?? null,
    clientVersion: row.client_version,
    rulesetVersion: row.ruleset_version,
    status: row.status as RunStatus,
    verified: row.verified,
    rejectReason: row.reject_reason ?? null,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? null,
  };
}

function toPlayer(row: any): PlayerRow {
  return {
    id: row.id,
    nickname: row.nickname,
    contactType: row.contact_type,
    contactValue: row.contact_value,
    email: row.email ?? null,
    phone: row.phone ?? null,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
    supporterBadge: row.supporter_badge ?? false,
    supporterBadgeGrantedAt: row.supporter_badge_granted_at ?? null,
    supporterNote: row.supporter_note ?? null,
  };
}

function toSeason(row: any): SeasonRow {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    clientVersion: row.client_version,
    rulesetVersion: row.ruleset_version,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function toDailyChallenge(row: any): DailyChallengeRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    dateKey: row.date_key,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    seed: row.seed,
    groupASetId: row.group_a_set_id,
    groupBSetId: row.group_b_set_id,
    config: row.config ?? null,
    createdAt: row.created_at,
    settledAt: row.settled_at ?? null,
  };
}

function toDailyUserStatus(row: any): DailyUserStatusRow {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    dateKey: row.date_key,
    adRefillUsed: row.ad_refill_used,
    updatedAt: row.updated_at,
  };
}

function toBestScore(row: any): BestScoreRow {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    mode: row.mode as RunMode,
    scopeKey: row.scope_key,
    score: row.score,
    seasonPoints: row.season_points,
    cleared: row.cleared ?? null,
    runId: row.run_id ?? null,
    updatedAt: row.updated_at,
  };
}

function toPuzzleRecord(row: any): PuzzleRecordRow {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    puzzleKey: row.puzzle_key,
    cleared: !!row.cleared,
    bestClearSpin: row.best_clear_spin ?? null,
    bestRemainingSpins: row.best_remaining_spins ?? null,
    bestPuzzleScore: row.best_puzzle_score ?? null,
    bestRunId: row.best_run_id ?? null,
    clearedAt: row.cleared_at ?? null,
    updatedAt: row.updated_at,
  };
}

function toSpireRecord(row: any): SpireRecordRow {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    bestStageReached: row.best_stage_reached,
    bestTotalScore: row.best_total_score,
    bestRunId: row.best_run_id ?? null,
    updatedAt: row.updated_at,
  };
}

function toScoreEvent(row: any): ScoreEventRow {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    sourceType: row.source_type,
    sourceId: row.source_id ?? null,
    previousTotalScore: row.previous_total_score,
    newTotalScore: row.new_total_score,
    delta: row.delta,
    previousRank: row.previous_rank ?? null,
    newRank: row.new_rank ?? null,
    createdAt: row.created_at,
  };
}

/** Supabase-backed Db. All access goes through the parameterized query builder. */
export class SupabaseDb implements Db {
  private get sb(): SupabaseClient {
    return getSupabaseAdmin();
  }

  async getEventBySlug(slug: string): Promise<EventRow | null> {
    const { data, error } = await this.sb
      .from('events')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data ? toEvent(data) : null;
  }

  async getEventById(id: string): Promise<EventRow | null> {
    const { data, error } = await this.sb
      .from('events')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? toEvent(data) : null;
  }

  async listEvents(): Promise<EventRow[]> {
    const { data, error } = await this.sb
      .from('events')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toEvent);
  }

  async createEvent(input: {
    slug: string;
    title: string;
    description?: string | null;
  }): Promise<EventRow> {
    const { data, error } = await this.sb
      .from('events')
      .insert({
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toEvent(data);
  }

  async setEventActive(slug: string, active: boolean): Promise<EventRow | null> {
    const { data, error } = await this.sb
      .from('events')
      .update({
        is_active: active,
        disabled_at: active ? null : new Date().toISOString(),
      })
      .eq('slug', slug)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toEvent(data) : null;
  }

  async updateEvent(
    slug: string,
    input: { title?: string; description?: string | null },
  ): Promise<EventRow | null> {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (Object.keys(patch).length === 0) return this.getEventBySlug(slug);
    const { data, error } = await this.sb
      .from('events')
      .update(patch)
      .eq('slug', slug)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toEvent(data) : null;
  }

  async createRun(input: CreateRunInput): Promise<RunRow> {
    const { data, error } = await this.sb
      .from('game_runs')
      .insert({
        event_id: input.eventId ?? null,
        player_id: input.playerId ?? null,
        season_id: input.seasonId ?? null,
        mode: input.mode ?? 'event',
        daily_date_key: input.dailyDateKey ?? null,
        puzzle_key: input.puzzleKey ?? null,
        stage_index: input.stageIndex ?? null,
        seed: input.seed,
        client_version: input.clientVersion,
        ruleset_version: input.rulesetVersion,
        status: 'pending',
        verified: false,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toRun(data);
  }

  async getRun(runId: string): Promise<RunRow | null> {
    const { data, error } = await this.sb
      .from('game_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();
    if (error) throw error;
    return data ? toRun(data) : null;
  }

  async finalizeRun(
    runId: string,
    input: FinalizeRunInput,
  ): Promise<RunRow | null> {
    const { data, error } = await this.sb
      .from('game_runs')
      .update({
        nickname: input.nickname,
        actions: input.actions,
        client_results: input.clientResults,
        score: input.score,
        best_spin_score: input.bestSpinScore,
        status: input.status,
        verified: input.verified,
        reject_reason: input.rejectReason,
        submitted_at: input.submittedAt,
        cleared: input.cleared ?? null,
        cleared_stage_count: input.clearedStageCount ?? null,
        season_points: input.seasonPoints ?? null,
      })
      .eq('id', runId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toRun(data) : null;
  }

  async invalidateRun(runId: string, reason: string): Promise<void> {
    const { error } = await this.sb
      .from('game_runs')
      .update({ status: 'rejected', reject_reason: reason, verified: false })
      .eq('id', runId);
    if (error) throw error;
  }

  async listRecentRuns(input: {
    mode?: RunMode;
    seasonId?: string;
    status?: RunStatus;
    limit?: number;
  }): Promise<RunRow[]> {
    let query = this.sb.from('game_runs').select('*');
    if (input.mode !== undefined) query = query.eq('mode', input.mode);
    if (input.seasonId !== undefined) query = query.eq('season_id', input.seasonId);
    if (input.status !== undefined) query = query.eq('status', input.status);
    const { data, error } = await query
      .order('submitted_at', { ascending: false })
      .limit(input.limit ?? 50);
    if (error) throw error;
    return (data ?? []).map(toRun);
  }

  async listLeaderboard(input: {
    slug: string;
    page: number;
    pageSize: number;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<LeaderboardPage> {
    const { slug, page, pageSize, clientVersion, rulesetVersion } = input;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.sb
      .from('game_runs')
      .select('nickname, score, best_spin_score, submitted_at, events!inner(slug)', {
        count: 'exact',
      })
      .eq('status', 'submitted')
      .eq('verified', true)
      .eq('client_version', clientVersion)
      .eq('ruleset_version', rulesetVersion)
      .order('score', { ascending: false })
      .order('best_spin_score', { ascending: false })
      .order('submitted_at', { ascending: true });

    if (slug !== TOTAL_SLUG) {
      query = query.eq('events.slug', slug);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const items: LeaderboardItem[] = (data ?? []).map((row: any, i: number) => ({
      rank: from + i + 1,
      nickname: row.nickname ?? 'Anonymous',
      score: row.score ?? 0,
      bestSpinScore: row.best_spin_score ?? 0,
      submittedAt: row.submitted_at ?? '',
      eventSlug: row.events?.slug ?? '',
    }));

    return { page, pageSize, totalCount: count ?? items.length, items };
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
    const { data, error } = await this.sb
      .from('players')
      .insert({
        nickname: input.nickname,
        contact_type: input.contactType,
        contact_value: input.contactValue,
        email: input.email ?? null,
        phone: input.phone ?? null,
        password_hash: input.passwordHash,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toPlayer(data);
  }

  async getPlayerById(id: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async getPlayerByNickname(nickname: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .select('*')
      .is('deleted_at', null)
      .ilike('nickname', nickname)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async getPlayerByEmail(email: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .select('*')
      .is('deleted_at', null)
      .ilike('email', email)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async getPlayerByPhone(phone: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .select('*')
      .is('deleted_at', null)
      .eq('phone', phone)
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async grantSupporterBadge(
    playerId: string,
    granted: boolean,
    note?: string | null,
  ): Promise<PlayerRow | null> {
    const patch: Record<string, unknown> = {
      supporter_badge: granted,
      supporter_badge_granted_at: granted ? new Date().toISOString() : null,
    };
    // Store the note on grant (only when provided); clear it on revoke.
    if (!granted) patch.supporter_note = null;
    else if (note !== undefined) patch.supporter_note = note;
    const { data, error } = await this.sb
      .from('players')
      .update(patch)
      .eq('id', playerId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async updatePlayerPassword(
    playerId: string,
    passwordHash: string,
  ): Promise<void> {
    const { error } = await this.sb
      .from('players')
      .update({ password_hash: passwordHash })
      .eq('id', playerId);
    if (error) throw error;
  }

  async deactivatePlayer(playerId: string): Promise<void> {
    // Soft-delete + anonymize: stamp deleted_at, clear the contact, and rename
    // to a stable anonymized nickname so leaderboards carry no PII. Freeing the
    // nickname relies on players_active_nickname_uidx (WHERE deleted_at IS NULL).
    const { error } = await this.sb
      .from('players')
      .update({
        deleted_at: new Date().toISOString(),
        contact_value: '',
        email: null,
        phone: null,
        nickname: `탈퇴회원${playerId.slice(0, 6)}`,
      })
      .eq('id', playerId);
    if (error) throw error;
  }

  // ── Season 1: seasons ──────────────────────────────────────────────────────
  async getSeasonBySlug(slug: string): Promise<SeasonRow | null> {
    const { data, error } = await this.sb
      .from('seasons')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw error;
    return data ? toSeason(data) : null;
  }

  async getActiveSeason(): Promise<SeasonRow | null> {
    const { data, error } = await this.sb
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toSeason(data) : null;
  }

  // ── Season 1: daily challenges ─────────────────────────────────────────────
  async getDailyChallenge(
    seasonId: string,
    dateKey: string,
  ): Promise<DailyChallengeRow | null> {
    const { data, error } = await this.sb
      .from('daily_challenges')
      .select('*')
      .eq('season_id', seasonId)
      .eq('date_key', dateKey)
      .maybeSingle();
    if (error) throw error;
    return data ? toDailyChallenge(data) : null;
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
    // Re-upsert returns the existing row untouched (the /api/daily/current route
    // upserts on every load) — crucially this PRESERVES settled_at, so settling
    // is never undone by a later page load. New rows get settled_at null.
    const existing = await this.getDailyChallenge(input.seasonId, input.dateKey);
    if (existing) return existing;
    const { data, error } = await this.sb
      .from('daily_challenges')
      .insert({
        season_id: input.seasonId,
        date_key: input.dateKey,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        seed: input.seed,
        group_a_set_id: input.groupASetId,
        group_b_set_id: input.groupBSetId,
        config: input.config ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toDailyChallenge(data);
  }

  async listSeasonDailyChallenges(seasonId: string): Promise<DailyChallengeRow[]> {
    const { data, error } = await this.sb
      .from('daily_challenges')
      .select('*')
      .eq('season_id', seasonId);
    if (error) throw error;
    return (data ?? []).map(toDailyChallenge);
  }

  async settleDailyChallenge(input: {
    seasonId: string;
    dateKey: string;
    settledAt: string;
    rewards: Array<{ playerId: string; seasonPoints: number }>;
  }): Promise<void> {
    // Overwrite each player's daily best_scores row season_points with the
    // settled rank reward (NOT a max), then stamp settled_at on the challenge.
    for (const reward of input.rewards) {
      const { error } = await this.sb
        .from('best_scores')
        .update({ season_points: reward.seasonPoints })
        .eq('player_id', reward.playerId)
        .eq('season_id', input.seasonId)
        .eq('mode', 'daily')
        .eq('scope_key', input.dateKey);
      if (error) throw error;
    }
    const { error: stampError } = await this.sb
      .from('daily_challenges')
      .update({ settled_at: input.settledAt })
      .eq('season_id', input.seasonId)
      .eq('date_key', input.dateKey);
    if (stampError) throw stampError;
  }

  async countResolvedDailyRuns(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<number> {
    const { count, error } = await this.sb
      .from('game_runs')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', input.playerId)
      .eq('season_id', input.seasonId)
      .eq('mode', 'daily')
      .eq('daily_date_key', input.dateKey)
      .in('status', ['submitted', 'rejected']);
    if (error) throw error;
    return count ?? 0;
  }

  async getDailyUserStatus(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow | null> {
    const { data, error } = await this.sb
      .from('daily_user_status')
      .select('*')
      .eq('player_id', input.playerId)
      .eq('season_id', input.seasonId)
      .eq('date_key', input.dateKey)
      .maybeSingle();
    if (error) throw error;
    return data ? toDailyUserStatus(data) : null;
  }

  async setDailyAdRefillUsed(input: {
    playerId: string;
    seasonId: string;
    dateKey: string;
  }): Promise<DailyUserStatusRow> {
    const existing = await this.getDailyUserStatus(input);
    if (existing) {
      const { data, error } = await this.sb
        .from('daily_user_status')
        .update({ ad_refill_used: true, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return toDailyUserStatus(data);
    }
    const { data, error } = await this.sb
      .from('daily_user_status')
      .insert({
        player_id: input.playerId,
        season_id: input.seasonId,
        date_key: input.dateKey,
        ad_refill_used: true,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toDailyUserStatus(data);
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
    const { data: existingRow, error: selectError } = await this.sb
      .from('best_scores')
      .select('*')
      .eq('player_id', input.playerId)
      .eq('season_id', input.seasonId)
      .eq('mode', input.mode)
      .eq('scope_key', input.scopeKey)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existingRow) {
      const { data, error } = await this.sb
        .from('best_scores')
        .insert({
          player_id: input.playerId,
          season_id: input.seasonId,
          mode: input.mode,
          scope_key: input.scopeKey,
          score: input.score,
          season_points: input.seasonPoints,
          cleared: !!input.cleared,
          run_id: input.runId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toBestScore(data);
    }

    const existing = toBestScore(existingRow);
    const patch: Record<string, unknown> = {
      cleared: !!existing.cleared || !!input.cleared,
    };
    if (input.score > existing.score) {
      patch.score = input.score;
      patch.season_points = input.seasonPoints;
      patch.run_id = input.runId;
      patch.updated_at = new Date().toISOString();
    }
    const { data, error } = await this.sb
      .from('best_scores')
      .update(patch)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return toBestScore(data);
  }

  async listPlayerBestScores(
    playerId: string,
    seasonId: string,
  ): Promise<BestScoreRow[]> {
    const { data, error } = await this.sb
      .from('best_scores')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId);
    if (error) throw error;
    return (data ?? []).map(toBestScore);
  }

  async listSeasonBestScores(seasonId: string): Promise<BestScoreRow[]> {
    const { data, error } = await this.sb
      .from('best_scores')
      .select('*')
      .eq('season_id', seasonId);
    if (error) throw error;
    return (data ?? []).map(toBestScore);
  }

  async listDailyBestScores(
    seasonId: string,
    dateKey: string,
  ): Promise<BestScoreRow[]> {
    const { data, error } = await this.sb
      .from('best_scores')
      .select('*')
      .eq('season_id', seasonId)
      .eq('mode', 'daily')
      .eq('scope_key', dateKey)
      .order('score', { ascending: false })
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toBestScore);
  }

  // ── Quick game (guest + member) ranking ────────────────────────────────────
  async listQuickBestScores(input: {
    seasonId: string | null;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<
    Array<{ nickname: string; score: number; bestSpinScore: number; submittedAt: string }>
  > {
    let query = this.sb
      .from('game_runs')
      .select('nickname, score, best_spin_score, submitted_at')
      .eq('mode', 'quick')
      .eq('status', 'submitted')
      .eq('verified', true)
      .eq('client_version', input.clientVersion)
      .eq('ruleset_version', input.rulesetVersion)
      .order('score', { ascending: false })
      .order('best_spin_score', { ascending: false })
      .order('submitted_at', { ascending: true });

    // Match the season bucket, treating null as the no-season bucket.
    query =
      input.seasonId === null
        ? query.is('season_id', null)
        : query.eq('season_id', input.seasonId);

    const { data, error } = await query;
    if (error) throw error;

    // Dedupe by nickname keeping the best. Rows arrive already sorted
    // (score desc, best_spin_score desc, submitted_at asc), so the first
    // occurrence per nickname is the best one.
    const best = new Map<
      string,
      { nickname: string; score: number; bestSpinScore: number; submittedAt: string }
    >();
    for (const row of (data ?? []) as any[]) {
      const nickname = (row.nickname ?? 'Anonymous') as string;
      if (best.has(nickname)) continue;
      best.set(nickname, {
        nickname,
        score: row.score ?? 0,
        bestSpinScore: row.best_spin_score ?? 0,
        submittedAt: row.submitted_at ?? '',
      });
    }

    return [...best.values()].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.bestSpinScore !== a.bestSpinScore) return b.bestSpinScore - a.bestSpinScore;
      return a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : 0;
    });
  }

  async reassignGuestQuickRuns(input: {
    guestDisplayName: string;
    playerId: string;
    nickname: string;
  }): Promise<number> {
    const { data, error } = await this.sb
      .from('game_runs')
      .update({ player_id: input.playerId, nickname: input.nickname })
      .eq('mode', 'quick')
      .is('player_id', null)
      .eq('nickname', input.guestDisplayName)
      .select('id');
    if (error) throw error;
    return (data ?? []).length;
  }

  // ── Season 1 WU8: puzzle records ───────────────────────────────────────────
  async upsertPuzzleRecord(input: {
    playerId: string;
    seasonId: string;
    puzzleKey: string;
    cleared: boolean;
    clearSpin: number | null;
    remainingSpins: number | null;
    puzzleScore: number | null;
    runId: string | null;
    clearedAt: string | null;
  }): Promise<PuzzleRecordRow> {
    const { data: existingRow, error: selectError } = await this.sb
      .from('puzzle_user_records')
      .select('*')
      .eq('player_id', input.playerId)
      .eq('season_id', input.seasonId)
      .eq('puzzle_key', input.puzzleKey)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existingRow) {
      const { data, error } = await this.sb
        .from('puzzle_user_records')
        .insert({
          player_id: input.playerId,
          season_id: input.seasonId,
          puzzle_key: input.puzzleKey,
          cleared: input.cleared,
          best_clear_spin: input.cleared ? input.clearSpin : null,
          best_remaining_spins: input.cleared ? input.remainingSpins : null,
          best_puzzle_score: input.cleared ? input.puzzleScore : null,
          best_run_id: input.cleared ? input.runId : null,
          cleared_at: input.cleared ? input.clearedAt : null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toPuzzleRecord(data);
    }

    const existing = toPuzzleRecord(existingRow);
    // Only a clear can improve a record. Improvement = first clear, OR fewer
    // clear spins, OR (tie on spins) a higher puzzle score.
    if (!input.cleared) return existing;
    const improves =
      !existing.cleared ||
      existing.bestClearSpin === null ||
      (input.clearSpin !== null &&
        (input.clearSpin < existing.bestClearSpin ||
          (input.clearSpin === existing.bestClearSpin &&
            (input.puzzleScore ?? 0) > (existing.bestPuzzleScore ?? 0))));
    if (!improves) return existing;

    const { data, error } = await this.sb
      .from('puzzle_user_records')
      .update({
        cleared: true,
        best_clear_spin: input.clearSpin,
        best_remaining_spins: input.remainingSpins,
        best_puzzle_score: input.puzzleScore,
        best_run_id: input.runId,
        cleared_at: input.clearedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return toPuzzleRecord(data);
  }

  async listPlayerPuzzleRecords(
    playerId: string,
    seasonId: string,
  ): Promise<PuzzleRecordRow[]> {
    const { data, error } = await this.sb
      .from('puzzle_user_records')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId);
    if (error) throw error;
    return (data ?? []).map(toPuzzleRecord);
  }

  async getPuzzleDistribution(
    seasonId: string,
    puzzleKey: string,
  ): Promise<PuzzleDistribution> {
    const { data, error } = await this.sb
      .from('puzzle_user_records')
      .select('cleared, best_clear_spin')
      .eq('season_id', seasonId)
      .eq('puzzle_key', puzzleKey);
    if (error) throw error;
    const bySpin: Record<number, number> = {};
    let notCleared = 0;
    for (const row of data ?? []) {
      const cleared = !!(row as any).cleared;
      const spin = (row as any).best_clear_spin as number | null;
      if (cleared && spin !== null && spin !== undefined) {
        bySpin[spin] = (bySpin[spin] ?? 0) + 1;
      } else {
        notCleared += 1;
      }
    }
    return { bySpin, notCleared };
  }

  // ── Season 1 WU9: spire records ────────────────────────────────────────────
  async upsertSpireRecord(input: {
    playerId: string;
    seasonId: string;
    stageReached: number;
    totalScore: number;
    runId: string | null;
  }): Promise<SpireRecordRow> {
    const { data: existingRow, error: selectError } = await this.sb
      .from('spire_user_records')
      .select('*')
      .eq('player_id', input.playerId)
      .eq('season_id', input.seasonId)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existingRow) {
      const { data, error } = await this.sb
        .from('spire_user_records')
        .insert({
          player_id: input.playerId,
          season_id: input.seasonId,
          best_stage_reached: input.stageReached,
          best_total_score: input.totalScore,
          best_run_id: input.runId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return toSpireRecord(data);
    }

    const existing = toSpireRecord(existingRow);
    const better =
      input.stageReached > existing.bestStageReached ||
      (input.stageReached === existing.bestStageReached &&
        input.totalScore > existing.bestTotalScore);
    if (!better) return existing;

    const { data, error } = await this.sb
      .from('spire_user_records')
      .update({
        best_stage_reached: input.stageReached,
        best_total_score: input.totalScore,
        best_run_id: input.runId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return toSpireRecord(data);
  }

  async getSpireRecord(
    playerId: string,
    seasonId: string,
  ): Promise<SpireRecordRow | null> {
    const { data, error } = await this.sb
      .from('spire_user_records')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId)
      .maybeSingle();
    if (error) throw error;
    return data ? toSpireRecord(data) : null;
  }

  async listSpireRecords(seasonId: string): Promise<SpireRecordRow[]> {
    const { data, error } = await this.sb
      .from('spire_user_records')
      .select('*')
      .eq('season_id', seasonId);
    if (error) throw error;
    return (data ?? []).map(toSpireRecord);
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
    const { error } = await this.sb.from('season_scores').upsert(
      {
        player_id: input.playerId,
        season_id: input.seasonId,
        puzzle_score: input.puzzleScore,
        daily_score: input.dailyScore,
        spire_score: input.spireScore,
        total_score: input.totalScore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'player_id,season_id' },
    );
    if (error) throw error;
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
    const { data, error } = await this.sb
      .from('score_events')
      .insert({
        player_id: input.playerId,
        season_id: input.seasonId,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        previous_total_score: input.previousTotalScore,
        new_total_score: input.newTotalScore,
        delta: input.delta,
        previous_rank: input.previousRank,
        new_rank: input.newRank,
      })
      .select('*')
      .single();
    if (error) throw error;
    return toScoreEvent(data);
  }

  async listScoreEvents(
    playerId: string,
    seasonId: string,
    limit = 50,
  ): Promise<ScoreEventRow[]> {
    const { data, error } = await this.sb
      .from('score_events')
      .select('*')
      .eq('player_id', playerId)
      .eq('season_id', seasonId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(toScoreEvent);
  }
}
