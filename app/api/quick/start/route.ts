import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { sanitizeNickname } from '@/lib/server/validation';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

type StartBody = {
  nickname?: unknown;
};

// POST /api/quick/start — open a pending quick run on a fresh server seed.
// Members are identified by their cookie; guests must pass a display nickname.
// Quick runs are scoped to the active season but never count toward season points.
export async function POST(req: Request) {
  let body: StartBody = {};
  try {
    body = (await req.json()) as StartBody;
  } catch {
    // An empty/invalid body is fine for signed-in players; guests fail the
    // nickname check below.
    body = {};
  }

  const player = await currentPlayer();

  let playerId: string | null;
  if (player) {
    playerId = player.id;
  } else {
    // Guest: require a usable display name. Reject empty / Anonymous fallbacks.
    const nickname = sanitizeNickname(body.nickname);
    if (nickname === 'Anonymous') {
      return Response.json({ error: 'invalid_nickname' }, { status: 400 });
    }
    playerId = null;
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  // Quick runs are bucketed by season. Without an active season we would write
  // into the permanent null bucket, which the season-reset 기획 forbids — block
  // (QuickClient surfaces this as "진행 중인 시즌이 없습니다.").
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }
  const seasonId = season.id;

  const seed = `${randomUUID()}.${randomUUID()}`;
  const run = await db.createRun({
    playerId,
    seasonId,
    mode: 'quick',
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({ runId: run.id, seed });
}
