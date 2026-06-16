import { describe, it, expect, vi, beforeEach } from 'vitest';

// A minimal fake of the supabase query builder that records the ilike pattern
// and returns a scripted row set. Every chained filter returns `this`; awaiting
// the builder resolves to { data, error }. This lets us assert how SupabaseDb
// builds the contact lookups WITHOUT a real database.
type Row = Record<string, unknown>;
let scriptedRows: Row[] = [];
let lastIlike: { column: string; pattern: string } | null = null;
let lastLimit: number | null = null;

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.is = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.ilike = (column: string, pattern: string) => {
    lastIlike = { column, pattern };
    return builder;
  };
  builder.limit = (n: number) => {
    lastLimit = n;
    return builder;
  };
  // Awaiting the builder yields the scripted result.
  builder.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
    resolve({ data: scriptedRows, error: null });
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: () => makeBuilder() }),
}));

const { SupabaseDb } = await import('./supabase');

beforeEach(() => {
  scriptedRows = [];
  lastIlike = null;
  lastLimit = null;
});

function player(over: Partial<Row>): Row {
  return {
    id: 'id-1',
    nickname: 'Nick',
    contact_type: 'email',
    contact_value: 'n@e.com',
    email: 'n@e.com',
    phone: null,
    password_hash: 'h',
    created_at: 'now',
    deleted_at: null,
    ...over,
  };
}

describe('SupabaseDb contact lookups', () => {
  it('escapes LIKE metacharacters in the nickname ilike pattern', async () => {
    scriptedRows = [player({ id: 'wild', nickname: 'a_b%c' })];
    const db = new SupabaseDb();
    const found = await db.getPlayerByNickname('a_b%c');
    expect(found?.id).toBe('wild');
    // %, _ and \ are backslash-escaped so they match literally.
    expect(lastIlike).toEqual({ column: 'nickname', pattern: 'a\\_b\\%c' });
    // Lookup is capped (never .maybeSingle(), which throws on >1 row).
    expect(lastLimit).toBe(2);
  });

  it('does NOT throw when >1 row matches; prefers the exact-case row', async () => {
    // Two rows differing only by case — ilike returns both; we must pick the
    // exact-case match and not blow up.
    scriptedRows = [
      player({ id: 'lower', nickname: 'joe' }),
      player({ id: 'exact', nickname: 'Joe' }),
    ];
    const db = new SupabaseDb();
    const found = await db.getPlayerByNickname('Joe');
    expect(found?.id).toBe('exact');
  });

  it('falls back to the first row when no exact-case match exists', async () => {
    scriptedRows = [player({ id: 'a', nickname: 'JOE' })];
    const db = new SupabaseDb();
    const found = await db.getPlayerByNickname('joe');
    expect(found?.id).toBe('a');
  });

  it('returns null on no match', async () => {
    scriptedRows = [];
    const db = new SupabaseDb();
    expect(await db.getPlayerByNickname('nobody')).toBeNull();
  });

  it('escapes the email ilike pattern too', async () => {
    scriptedRows = [player({ id: 'e', email: 'a_b@e.com' })];
    const db = new SupabaseDb();
    const found = await db.getPlayerByEmail('a_b@e.com');
    expect(found?.id).toBe('e');
    expect(lastIlike).toEqual({ column: 'email', pattern: 'a\\_b@e.com' });
  });
});
