import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client using the SERVICE ROLE key. NEVER import this from
 * a client component — the service role key bypasses row-level security and must
 * never reach the browser. The `server-only` import makes a client bundle fail
 * the build if this module is ever pulled in.
 *
 * Created lazily so the app builds (and the in-memory Db works) without env vars.
 */
// Normalize a SUPABASE_URL to its ORIGIN only. supabase-js appends "/rest/v1"
// itself, so a value that already includes a path (e.g. ".../rest/v1/") or a
// trailing slash makes it build ".../rest/v1//rest/v1/..." → PostgREST
// PGRST125 ("Invalid path specified in request URL"). Taking the origin makes
// it work whether the user pasted the bare host or the full REST endpoint.
function normalizeUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = normalizeUrl(process.env.SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set; cannot use the Supabase Db.',
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── 8번출구(OWL) 프로젝트 DB — 읽기 전용 ──────────────────────────────────────
// 슬롯은 자체 DB(events/game_runs/패널티)를 그대로 쓰고, 참가자 화이트리스트와
// 랭킹 필터에 필요한 `players` 테이블만 8번출구 프로젝트 Supabase에서 읽는다.
// 별도 env(OWL_SUPABASE_URL / OWL_SUPABASE_SERVICE_ROLE_KEY)로 연결한다.
let owlCached: SupabaseClient | null = null;

export function getOwlSupabaseAdmin(): SupabaseClient {
  if (owlCached) return owlCached;
  const url = normalizeUrl(process.env.OWL_SUPABASE_URL);
  const key = process.env.OWL_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'OWL_SUPABASE_URL / OWL_SUPABASE_SERVICE_ROLE_KEY are not set; cannot read the 8번출구 whitelist.',
    );
  }
  owlCached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return owlCached;
}

export function hasOwlSupabaseEnv(): boolean {
  return Boolean(
    process.env.OWL_SUPABASE_URL && process.env.OWL_SUPABASE_SERVICE_ROLE_KEY,
  );
}
