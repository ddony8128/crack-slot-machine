import 'server-only';
import { getOwlSupabaseAdmin, hasOwlSupabaseEnv } from '@/lib/supabase/server';

/**
 * 8번출구(OWL) 프로젝트의 `players` 테이블을 화이트리스트로 읽어온다.
 *
 * 매 요청마다 외부 DB를 치지 않도록 프로세스 메모리에 짧은 TTL로 캐시한다.
 * 가져온 닉네임은 소문자로 정규화한 Set 으로 보관한다(대소문자 무시 매칭).
 *
 * 8번출구 대시보드가 세션 종료 시 players 행을 hard-delete 하므로, "현재 Set 에
 * 존재 = 활성 참가자" 가 성립한다. 화이트리스트 게이트와 랭킹 필터가 이 Set 을 공유한다.
 */

const TTL_MS = 30_000;

type CacheEntry = { set: Set<string>; at: number };
let cache: CacheEntry | null = null;
let inflight: Promise<Set<string>> | null = null;

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return !!entry && Date.now() - entry.at < TTL_MS;
}

async function fetchOwlNicknames(): Promise<Set<string>> {
  const sb = getOwlSupabaseAdmin();
  const { data, error } = await sb.from('players').select('nickname');
  if (error) throw error;
  const set = new Set<string>();
  for (const row of data ?? []) {
    const nick = (row as { nickname?: string | null }).nickname;
    if (typeof nick === 'string' && nick.trim()) {
      set.add(nick.trim().toLowerCase());
    }
  }
  return set;
}

/**
 * 현재 8번출구 화이트리스트 닉네임 Set(소문자). TTL 내에는 캐시를 반환한다.
 * 외부 DB 조회 실패 시, 직전 캐시(stale)가 있으면 그걸 반환해 행사 중 일시적
 * 네트워크 장애로 전원이 막히는 일을 피한다(없으면 에러를 던진다).
 */
export async function getOwlNicknameSet(): Promise<Set<string>> {
  if (isFresh(cache)) return cache.set;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const set = await fetchOwlNicknames();
      cache = { set, at: Date.now() };
      return set;
    } catch (e) {
      if (cache) return cache.set; // stale-but-usable fallback
      throw e;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** 닉네임이 현재 8번출구 화이트리스트에 있는지(대소문자 무시). */
export async function isOwlNicknameWhitelisted(
  nickname: string,
): Promise<boolean> {
  const set = await getOwlNicknameSet();
  return set.has(nickname.trim().toLowerCase());
}

/** OWL DB 연결이 설정돼 있는지. 없으면 호출부는 슬롯 자체 화이트리스트로 폴백한다. */
export function owlWhitelistEnabled(): boolean {
  return hasOwlSupabaseEnv();
}

/** 테스트/운영용: 캐시 강제 무효화. */
export function clearOwlWhitelistCache(): void {
  cache = null;
  inflight = null;
}
