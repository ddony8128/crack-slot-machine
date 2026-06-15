import {
  SPIRE_STAGES,
  SPIRE_REWARD_TYPES,
  SPIRE_ARTIFACTS,
} from "@/lib/spire/config";

// GET /api/spire — the Season 1 첨탑 오르기 (Spire) catalog (stub): stage
// targets, reward types, and artifacts.
export async function GET() {
  return Response.json({
    stages: SPIRE_STAGES,
    rewardTypes: SPIRE_REWARD_TYPES,
    artifacts: SPIRE_ARTIFACTS,
  });
}
