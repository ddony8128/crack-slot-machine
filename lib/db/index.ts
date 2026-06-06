import 'server-only';
import type { Db } from '@/lib/db/types';
import { hasSupabaseEnv } from '@/lib/supabase/server';
import { SupabaseDb } from '@/lib/db/supabase';
import { MemoryDb } from '@/lib/db/memory';

export * from '@/lib/db/types';

// A process-wide MemoryDb so local dev without Supabase keeps data within a run.
let memorySingleton: MemoryDb | null = null;

/**
 * The active Db: Supabase when credentials are present, otherwise an in-memory
 * fallback (local dev / preview without env). Tests import MemoryDb directly.
 */
export function getDb(): Db {
  if (hasSupabaseEnv()) return new SupabaseDb();
  if (!memorySingleton) memorySingleton = new MemoryDb();
  return memorySingleton;
}
