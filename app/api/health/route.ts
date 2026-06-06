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
    // Surface the real cause: supabase-js throws a PostgrestError (not an Error
    // instance) with message/code/details/hint.
    if (e instanceof Error) dbError = e.message;
    else if (e && typeof e === "object") {
      const pg = e as { message?: string; code?: string; details?: string; hint?: string };
      dbError = JSON.stringify({ message: pg.message, code: pg.code, details: pg.details, hint: pg.hint });
    } else {
      dbError = String(e);
    }
  }
  // Presence-only booleans (NEVER the values) to pinpoint which env var the
  // running deployment can actually see.
  const env = {
    hasUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
    hasAdminSecret: Boolean(process.env.ADMIN_SESSION_SECRET),
    hasSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };
  return Response.json({ supabaseEnv: hasSupabaseEnv(), env, events, dbError });
}
