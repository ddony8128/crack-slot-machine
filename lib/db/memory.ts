import type {
  Db,
  EventRow,
  RunRow,
  CreateRunInput,
  FinalizeRunInput,
  LeaderboardItem,
  LeaderboardPage,
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

/**
 * In-memory Db for tests and local dev without Supabase credentials. Replicates
 * the SQL filtering/sorting semantics. Not persistent across process restarts.
 */
export class MemoryDb implements Db {
  private events: EventRow[];
  private runs: RunRow[] = [];
  private counter = 0;

  constructor(events?: EventRow[]) {
    this.events = events ?? seedEvents();
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
      eventId: input.eventId,
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
    return row;
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
        eventSlug: eventBySlug.get(r.eventId)?.slug ?? '',
      }));

    return { page, pageSize, totalCount, items };
  }
}
