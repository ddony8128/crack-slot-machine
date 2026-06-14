import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type {
  Db,
  EventRow,
  PlayerRow,
  RunRow,
  RunStatus,
  CreateRunInput,
  FinalizeRunInput,
  LeaderboardItem,
  LeaderboardPage,
  ClientResults,
} from '@/lib/db/types';
import { TOTAL_SLUG } from '@/lib/db/types';
import type { RecordedAction } from '@/store/gameStore';
import type { AchievementKey } from '@/types';

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

function toPlayer(row: any): PlayerRow {
  return {
    id: row.id,
    nickname: row.nickname,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  };
}

function toRun(row: any): RunRow {
  return {
    id: row.id,
    eventId: row.event_id,
    playerId: row.player_id ?? null,
    nickname: row.nickname ?? null,
    achievements: (row.achievements ?? []) as AchievementKey[],
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
        event_id: input.eventId,
        player_id: input.playerId ?? null,
        seed: input.seed,
        client_version: input.clientVersion,
        ruleset_version: input.rulesetVersion,
        status: 'pending',
        verified: false,
        achievements: [],
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
        achievements: input.achievements,
        actions: input.actions,
        client_results: input.clientResults,
        score: input.score,
        best_spin_score: input.bestSpinScore,
        status: input.status,
        verified: input.verified,
        reject_reason: input.rejectReason,
        submitted_at: input.submittedAt,
      })
      .eq('id', runId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toRun(data) : null;
  }

  async listLeaderboard(input: {
    slug: string;
    page: number;
    pageSize: number;
    clientVersion: string;
    rulesetVersion: number;
  }): Promise<LeaderboardPage> {
    const { slug, page, pageSize, clientVersion, rulesetVersion } = input;

    // Fetch ALL qualifying rows (event-scale: hundreds of players), then dedupe
    // to the best run per nickname, sort, and paginate in JS.
    let query = this.sb
      .from('game_runs')
      .select('nickname, score, best_spin_score, submitted_at, events!inner(slug)')
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

    const { data, error } = await query;
    if (error) throw error;

    // Rows arrive in ranking order, so the first row per nickname is its best.
    const seen = new Set<string>();
    const deduped = (data ?? []).filter((row: any) => {
      const key = row.nickname ?? 'Anonymous';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const totalCount = deduped.length;
    const from = (page - 1) * pageSize;
    const items: LeaderboardItem[] = deduped
      .slice(from, from + pageSize)
      .map((row: any, i: number) => ({
        rank: from + i + 1,
        nickname: row.nickname ?? 'Anonymous',
        score: row.score ?? 0,
        bestSpinScore: row.best_spin_score ?? 0,
        submittedAt: row.submitted_at ?? '',
        eventSlug: row.events?.slug ?? '',
      }));

    return { page, pageSize, totalCount, items };
  }

  // ── players whitelist (BLACKHAVEN) ─────────────────────────────────────────
  async listPlayers(opts?: { includeDeleted?: boolean }): Promise<PlayerRow[]> {
    let query = this.sb
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });
    if (!opts?.includeDeleted) {
      query = query.is('deleted_at', null);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toPlayer);
  }

  async getActivePlayerByNickname(nickname: string): Promise<PlayerRow | null> {
    const target = nickname.trim().toLowerCase();
    // Escape LIKE wildcards so a nickname containing % or _ matches literally;
    // then confirm an exact (case-insensitive) match in JS so this never throws
    // on multiple rows and stays consistent with the in-memory impl.
    const pattern = nickname.trim().replace(/[%_\\]/g, '\\$&');
    const { data, error } = await this.sb
      .from('players')
      .select('*')
      .is('deleted_at', null)
      .ilike('nickname', pattern);
    if (error) throw error;
    const match = (data ?? []).find(
      (r: any) => (r.nickname ?? '').toLowerCase() === target,
    );
    return match ? toPlayer(match) : null;
  }

  async createPlayer(nickname: string): Promise<PlayerRow> {
    const existing = await this.getActivePlayerByNickname(nickname);
    if (existing) {
      throw new Error(`active player nickname already exists: ${nickname}`);
    }
    const { data, error } = await this.sb
      .from('players')
      .insert({ nickname })
      .select('*')
      .single();
    if (error) throw error;
    return toPlayer(data);
  }

  async softDeletePlayer(id: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  async restorePlayer(id: string): Promise<PlayerRow | null> {
    const { data, error } = await this.sb
      .from('players')
      .update({ deleted_at: null })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data ? toPlayer(data) : null;
  }

  // ── rewards / achievements (BLACKHAVEN) ────────────────────────────────────
  async getPlayerBestScore(
    playerId: string,
    eventId: string,
  ): Promise<number | null> {
    const { data, error } = await this.sb
      .from('game_runs')
      .select('score')
      .eq('player_id', playerId)
      .eq('event_id', eventId)
      .eq('status', 'submitted')
      .eq('verified', true)
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.score ?? null;
  }

  async getPlayerAchievements(
    playerId: string,
    eventId: string,
  ): Promise<AchievementKey[]> {
    const { data, error } = await this.sb
      .from('game_runs')
      .select('achievements')
      .eq('player_id', playerId)
      .eq('event_id', eventId)
      .eq('status', 'submitted')
      .eq('verified', true);
    if (error) throw error;
    const set = new Set<AchievementKey>();
    for (const row of data ?? []) {
      for (const a of (row.achievements ?? []) as AchievementKey[]) set.add(a);
    }
    return [...set];
  }
}
