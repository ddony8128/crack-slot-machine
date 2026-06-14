import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { isValidSlug, sanitizeNickname } from '@/lib/server/validation';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

type StartBody = { nickname?: unknown };

// POST /api/events/[slug]/start — open a pending run with a server-issued seed.
// The nickname is gated against the global whitelist BEFORE any run is created.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  if (!isValidSlug(slug)) {
    return Response.json({ error: 'invalid_slug' }, { status: 400 });
  }

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const nickname = sanitizeNickname(body.nickname);

  const db = getDb();
  const event = await db.getEventBySlug(slug);
  if (!event) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!event.isActive) {
    return Response.json({ error: 'event_inactive' }, { status: 403 });
  }

  // Whitelist gate: only registered, active nicknames may open a run.
  const player = await db.getActivePlayerByNickname(nickname);
  if (!player) {
    return Response.json(
      { error: 'nickname_not_whitelisted' },
      { status: 403 },
    );
  }

  // Server-generated seed: unguessable so a client cannot pre-compute outcomes.
  const seed = `${randomUUID()}.${randomUUID()}`;
  const run = await db.createRun({
    eventId: event.id,
    playerId: player.id,
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
