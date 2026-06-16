"use client";

import Modal from "@/components/Modal";

/**
 * 후원(donation) info modal. Cosmetic only — donating never affects gameplay or
 * season scoring. Opened by useDonationPrompt at a few natural "session over"
 * moments, and dismissible with the 닫기 button.
 */
export default function DonationModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="후원 안내" maxWidthClass="max-w-sm">
      <div className="flex max-h-[88vh] flex-col gap-4 overflow-y-auto p-6 text-sm leading-relaxed text-zinc-300">
        <h2 className="text-xl font-black tracking-tight text-amber-300">
          후원 안내
        </h2>

        <p>
          RULE SLOT은 1인 개발로 만들고 있는 실험적인 웹게임입니다.
          <br />
          후원금은 서버비와 개발 지속을 위해 사용됩니다.
        </p>

        <p className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 font-semibold text-emerald-200">
          후원은 선택이며, 게임 플레이와 시즌 점수 및 랭킹 산정에는 영향을 주지
          않습니다.
        </p>

        <p>
          후원은 1인당 최대 3만 원까지만 부탁드립니다.
          <br />1만 원 이상 후원해주신 분께는 감사 표시로 이번 시즌 랭킹에
          &lsquo;후원자&rsquo; 칭호를 달아드립니다.
          <br />
          그 외의 리워드는 아직 없습니다.
        </p>

        <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            후원 계좌
          </p>
          <p className="font-mono text-zinc-100">KB국민 938002-00-831798 김도현</p>
          <p className="text-zinc-400">또는 카카오페이 송금</p>
        </div>

        {/* KakaoPay QR placeholder (no image asset yet). */}
        <div className="flex aspect-square w-32 flex-col items-center justify-center self-center rounded-xl border border-dashed border-zinc-600 bg-zinc-900/40 text-center text-xs text-zinc-500">
          카카오페이 QR
          <br />
          (준비 중)
        </div>

        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
          입금자명에 반드시 RS + 닉네임을 적어주세요. (예: RS도현)
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900/40 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800/60"
        >
          닫기
        </button>
      </div>
    </Modal>
  );
}
