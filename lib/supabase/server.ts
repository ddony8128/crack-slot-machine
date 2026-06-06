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
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  // Normalize SUPABASE_URL to its ORIGIN only. supabase-js appends "/rest/v1"
  // itself, so a value that already includes a path (e.g. ".../rest/v1/") or a
  // trailing slash makes it build ".../rest/v1//rest/v1/..." → PostgREST
  // PGRST125 ("Invalid path specified in request URL"). Taking the origin makes
  // it work whether the user pasted the bare host or the full REST endpoint.
  const rawUrl = process.env.SUPABASE_URL?.trim();
  let url: string | undefined;
  if (rawUrl) {
    try {
      url = new URL(rawUrl).origin;
    } catch {
      url = rawUrl.replace(/\/+$/, '');
    }
  }
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
