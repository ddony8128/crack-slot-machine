import { readSpireLeaderboard } from '@/lib/spire/leaderboard';

// GET /api/spire/leaderboard — the active season's 첨탑 ranking (best run per
// player), highest stage then score first, nicknames resolved.
export async function GET() {
  const result = await readSpireLeaderboard();
  return Response.json(result);
}
