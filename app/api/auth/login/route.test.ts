import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryDb } from '@/lib/db/memory';
import { hashPassword } from '@/lib/server/password';

// Inject a fresh in-memory DB per test, and stub the cookie writer (which would
// otherwise reach into next/headers) so the route is unit-testable.
let db: MemoryDb;
const setPlayerCookie = vi.fn<(id: string) => Promise<void>>(async () => {});

vi.mock('@/lib/db', () => ({ getDb: () => db }));
vi.mock('@/lib/server/playerAuth', () => ({
  setPlayerCookie: (id: string) => setPlayerCookie(id),
}));

// Imported AFTER the mocks are registered.
const { POST } = await import('./route');

function req(body: unknown): Request {
  return new Request('http://test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function seedPlayer(input: {
  nickname: string;
  email?: string | null;
  phone?: string | null;
  password: string;
}) {
  return db.createPlayer({
    nickname: input.nickname,
    contactType: input.email ? 'email' : 'phone',
    contactValue: input.email ?? input.phone ?? '',
    email: input.email ?? null,
    phone: input.phone ?? null,
    passwordHash: hashPassword(input.password),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    db = new MemoryDb();
    setPlayerCookie.mockClear();
  });

  it('logs in by nickname (case-insensitive)', async () => {
    const p = await seedPlayer({
      nickname: 'Alice',
      email: 'alice@example.com',
      password: 'hunter2hunter',
    });
    const res = await POST(req({ identifier: 'alice', password: 'hunter2hunter' }));
    expect(res.status).toBe(200);
    expect((await res.json()).player.id).toBe(p.id);
    expect(setPlayerCookie).toHaveBeenCalledWith(p.id);
  });

  it('logs in by email', async () => {
    const p = await seedPlayer({
      nickname: 'Bob',
      email: 'bob@example.com',
      password: 'correctbattery',
    });
    const res = await POST(
      req({ identifier: 'BOB@example.com', password: 'correctbattery' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).player.id).toBe(p.id);
  });

  it('logs in by phone', async () => {
    const p = await seedPlayer({
      nickname: 'Carol',
      phone: '01012345678',
      password: 'phonepassword',
    });
    const res = await POST(
      req({ identifier: '01012345678', password: 'phonepassword' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).player.id).toBe(p.id);
  });

  it('still accepts the legacy `nickname` field', async () => {
    await seedPlayer({ nickname: 'Legacy', email: 'l@e.com', password: 'legacypass1' });
    const res = await POST(req({ nickname: 'Legacy', password: 'legacypass1' }));
    expect(res.status).toBe(200);
  });

  it('rejects a wrong password with 401 invalid_credentials', async () => {
    await seedPlayer({ nickname: 'Dave', email: 'd@e.com', password: 'rightpassword' });
    const res = await POST(req({ identifier: 'Dave', password: 'wrongpassword' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_credentials');
    expect(setPlayerCookie).not.toHaveBeenCalled();
  });

  it('rejects an unknown identifier with 401', async () => {
    const res = await POST(req({ identifier: 'ghost', password: 'whatever12' }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('invalid_credentials');
  });

  it('rejects an empty identifier with 401 (no cookie set)', async () => {
    await seedPlayer({ nickname: 'Eve', email: 'e@e.com', password: 'evepassword' });
    const res = await POST(req({ identifier: '', password: 'evepassword' }));
    expect(res.status).toBe(401);
    expect(setPlayerCookie).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON', async () => {
    const bad = new Request('http://test/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await POST(bad);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_json');
  });
});
