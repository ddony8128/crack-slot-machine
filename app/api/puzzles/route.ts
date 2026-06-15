import { PUZZLES } from "@/lib/puzzle/config";

// GET /api/puzzles — the Season 1 puzzle list (stub; no auth needed for the
// list). Exposes only player-facing metadata, not the structured goal spec.
export async function GET() {
  return Response.json({
    puzzles: PUZZLES.map((p) => ({
      key: p.key,
      index: p.index,
      title: p.title,
      goalText: p.goalText,
      spinLimit: p.spinLimit,
    })),
  });
}
