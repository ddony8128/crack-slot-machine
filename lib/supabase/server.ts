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
  // Sanitize: trim whitespace and strip any trailing slash(es). A trailing "/"
  // on SUPABASE_URL makes supabase-js build ".../​/rest/v1/..." which PostgREST
  // rejects with PGRST125 ("Invalid path specified in request URL").
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
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
