import { getDb } from "@/lib/db";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Diagnostic only — exposes whether the running deployment sees the Supabase
// env vars and what event states the app actually reads. No secrets returned.
// supabaseEnv:false => running on the in-memory fallback (env not picked up).
export async function GET() {
  let events: { slug: string; isActive: boolean }[] = [];
  let dbError: string | null = null;
  try {
    events = (await getDb().listEvents()).map((e) => ({
      slug: e.slug,
      isActive: e.isActive,
    }));
  } catch (e) {
    dbError = e instanceof Error ? e.message : "db_error";
  }
  return Response.json({ supabaseEnv: hasSupabaseEnv(), events, dbError });
}
