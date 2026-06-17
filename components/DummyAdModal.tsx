"use client";

import Modal from "@/components/Modal";
import { DEFAULT_DUMMY_AD } from "@/lib/ads/dummy";

/**
 * The daily ad-refill modal. There is no real ad SDK in v0.1, so this shows a
 * placeholder (dummy) ad; confirming grants the day's one-time +5 attempts.
 */
export default function DummyAdModal({
  open,
  onConfirm,
  onClose,
  pending,
  onDonate,
}: {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  pending: boolean;
  /** Opens the 후원 안내 modal. When omitted, the donation CTA is hidden. */
  onDonate?: () => void;
}) {
  const ad = DEFAULT_DUMMY_AD;

  return (
    <Modal open={open} onClose={onClose} ariaLabel={ad.title}>
      <div className="flex flex-col gap-4 p-6 text-center">
        <h2 className="text-xl font-black tracking-tight text-amber-300">
          {ad.title}
        </h2>
        <p className="text-sm leading-relaxed text-zinc-300">{ad.body}</p>

        {ad.linkUrl && (
          <a
            href={ad.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-400 underline hover:text-emerald-300"
          >
            {ad.linkText ?? "자세히 보기"}
          </a>
        )}

        {onDonate && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3 text-sm leading-relaxed text-emerald-200">
            광고 대신, 후원으로 개발을 응원해 주실 수도 있어요.
            <br />
            후원은 선택이며 게임 플레이·시즌 점수·랭킹에는 영향을 주지 않습니다.
          </div>
        )}

        <div className="mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {pending ? "충전 중…" : "5회 충전하기"}
          </button>
          {onDonate && (
            <button
              type="button"
              onClick={onDonate}
              disabled={pending}
              className="w-full rounded-xl border border-amber-500/50 bg-amber-500/10 px-6 py-3 text-base font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              후원 안내 보기
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
