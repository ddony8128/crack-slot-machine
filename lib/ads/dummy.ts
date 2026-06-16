/** Dummy ad config (no real ad SDK in v0.1). The daily ad-refill shows one of
 *  these; "충전하기" grants the day's +5 attempts (server-enforced, once/day). */
export type DummyAdConfig = {
  title: string;
  body: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
};

export const DEFAULT_DUMMY_AD: DummyAdConfig = {
  title: '광고 시청 후 일일 도전 5회 추가 (하루 1회)',
  body: '이곳에는 추후 광고가 들어갑니다. 현재는 테스트용 더미 광고입니다. 시청을 완료하면 오늘의 일일 도전 횟수가 5회 추가됩니다.',
  linkUrl: undefined,
  linkText: '자세히 보기',
};
