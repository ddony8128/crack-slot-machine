import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { PUZZLES_BY_KEY } from '@/lib/puzzle/config';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// POST /api/puzzles/[key]/start — open a pending puzzle run on the puzzle's
// fixed seed. Requires a signed-in player. The puzzle's start board, rule bag
// and spin limit live in PUZZLES_BY_KEY and are reconstructed identically on the
// client (puzzleRunConfig) and the server replay so verification matches.
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ key: string }> },
) {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { key } = await ctx.params;
  const puzzle = PUZZLES_BY_KEY[key];
  if (!puzzle) {
    return Response.json({ error: 'puzzle_not_found' }, { status: 404 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  // Unlock gate (spec §5): p02 requires a cleared p01 record for this player.
  if (key === 'p02') {
    const records = await db.listPlayerPuzzleRecords(player.id, season.id);
    const p01 = records.find((r) => r.puzzleKey === 'p01');
    if (!p01?.cleared) {
      return Response.json({ error: 'locked' }, { status: 403 });
    }
  }

  const run = await db.createRun({
    playerId: player.id,
    seasonId: season.id,
    mode: 'puzzle',
    puzzleKey: key,
    seed: puzzle.seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({ runId: run.id, seed: puzzle.seed });
}
