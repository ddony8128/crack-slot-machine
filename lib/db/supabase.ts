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
    eventId: row.event_id,
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

  async createRun(input: CreateRunInput): Promise<RunRow> {
    const { data, error } = await this.sb
      .from('game_runs')
      .insert({
        event_id: input.eventId,
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
}
