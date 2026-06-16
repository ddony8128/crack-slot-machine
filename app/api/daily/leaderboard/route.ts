import { readDailyLeaderboard } from '@/lib/daily/leaderboard';

// GET /api/daily/leaderboard?date=YYYY-MM-DD (default = today)
// Best score per player for the date, highest first, with nicknames resolved.
// Delegates to the shared read (which also settles any due daily windows) so the
// API and the leaderboard page can never drift.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const result = await readDailyLeaderboard(url.searchParams.get('date'));
  return Response.json(result);
}
