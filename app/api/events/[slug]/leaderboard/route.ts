import { getDb } from '@/lib/db';
import { isValidSlug } from '@/lib/server/validation';
import { CLIENT_VERSION, RULESET_VERSION } from '@/lib/version';
import {
  getOwlNicknameSet,
  owlWhitelistEnabled,
} from '@/lib/server/owlWhitelist';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

// GET /api/events/[slug]/leaderboard?page=&pageSize=
// Per-event board, or the combined all-events board when slug==='total'.
export async function GET(
  req: Request,
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

  const url = new URL(req.url);
  const page = clampInt(url.searchParams.get('page'), 1, 1, 100000);
  const pageSize = clampInt(
    url.searchParams.get('pageSize'),
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE,
  );

  // 운영(OWL env 설정 시): 현재 8번출구 화이트리스트에 남아 있는 닉네임만 노출.
  // → 8번출구 세션 종료(참가자 hard-delete)와 동시에 랭킹이 자동으로 비워진다.
  const allowedNicknames = owlWhitelistEnabled()
    ? [...(await getOwlNicknameSet())]
    : null;

  const result = await db.listLeaderboard({
    slug,
    page,
    pageSize,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
    allowedNicknames,
  });

  return Response.json({
    ...result,
    clientVersion: CLIENT_VERSION,
    rulesetVersion: RULESET_VERSION,
  });
}
