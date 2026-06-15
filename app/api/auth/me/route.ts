import { currentPlayer } from '@/lib/server/playerAuth';

// GET /api/auth/me — the signed-in player, or 401 when not authenticated.
export async function GET() {
  const player = await currentPlayer();
  if (!player) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  return Response.json({
    player: {
      id: player.id,
      nickname: player.nickname,
      contactType: player.contactType,
      supporterBadge: player.supporterBadge,
    },
  });
}
