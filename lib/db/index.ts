import 'server-only';
import type { Db } from '@/lib/db/types';
import { hasSupabaseEnv } from '@/lib/supabase/server';
import { SupabaseDb } from '@/lib/db/supabase';
import { MemoryDb } from '@/lib/db/memory';

export * from '@/lib/db/types';

// A process-wide MemoryDb so local dev without Supabase keeps data within a run.
// Stored on globalThis so every bundle (route handlers AND page RSCs) and HMR
// reloads share ONE instance in dev — a module-scoped singleton would otherwise
// give pages and routes separate in-memory stores.
const globalForDb = globalThis as unknown as { __ruleSlotMemoryDb?: MemoryDb };

/**
 * The active Db: Supabase when credentials are present, otherwise an in-memory
 * fallback (local dev / preview without env). Tests import MemoryDb directly.
 */
export function getDb(): Db {
  if (hasSupabaseEnv()) return new SupabaseDb();
  if (!globalForDb.__ruleSlotMemoryDb) globalForDb.__ruleSlotMemoryDb = new MemoryDb();
  return globalForDb.__ruleSlotMemoryDb;
}
