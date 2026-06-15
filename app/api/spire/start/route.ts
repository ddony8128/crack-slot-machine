import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db';
import { currentPlayer } from '@/lib/server/playerAuth';
import { pickSpireSetChoices } from '@/lib/spire/run';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';

// POST /api/spire/start — open a pending spire run on a server-issued seed.
// Requires a signed-in player and an active season. A spire run is ONE
// configurable run of 50 spins (10 stages × 5); the pre-stage-1 set choice is
// deterministically derived from the seed (pickSpireSetChoices), and the chosen
// set's RunConfig is reconstructed identically on the client and the server
// replay so verification matches.
export async function POST() {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const season = await db.getActiveSeason();
  if (!season) {
    return Response.json({ error: 'no_active_season' }, { status: 404 });
  }

  // Server-generated seed: unguessable so a client cannot pre-compute outcomes.
  const seed = `${randomUUID()}.${randomUUID()}`;
  const run = await db.createRun({
    playerId: player.id,
    seasonId: season.id,
    mode: 'spire',
    seed,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });

  return Response.json({
    runId: run.id,
    seed,
    choices: pickSpireSetChoices(seed),
  });
}
