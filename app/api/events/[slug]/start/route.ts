import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { isValidSlug } from '@/lib/server/validation';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// POST /api/events/[slug]/start — open a pending run with a server-issued seed.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }

  const db = getDb();
  const event = await db.getEventBySlug(slug);
  if (!event) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!event.isActive) {
    return Response.json({ error: 'event_inactive' }, { status: 403 });
  }

  // Server-generated seed: unguessable so a client cannot pre-compute outcomes.
  const seed = `${randomUUID()}.${randomUUID()}`;
  const run = await db.createRun({
    eventId: event.id,
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({
    runId: run.id,
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });
}
