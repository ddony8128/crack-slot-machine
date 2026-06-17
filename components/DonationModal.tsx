"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { fetchMe } from "@/lib/client/authApi";
import { submitFeedback } from "@/lib/client/feedbackApi";

/**
 * 후원(donation) info modal. Cosmetic only — donating never affects gameplay or
 * season scoring. Opened by useDonationPrompt at a few natural "session over"
 * moments, and dismissible with the 닫기 button.
 *
 * Also hosts the 후기/피드백 form: login-required, so it resolves the player on
 * open and shows either the form (rating + text) or a 로그인 prompt.
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

        {/* 카카오페이 송금 QR */}
        <div className="self-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kakaopay-qr.jpg"
            alt="카카오페이 송금 QR 코드"
            width={180}
            height={180}
            className="aspect-square w-44 rounded-xl border border-zinc-700 bg-white object-contain p-2"
          />
          <p className="mt-1 text-xs text-zinc-500">카카오페이 송금 QR</p>
        </div>

        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
          입금자명에 반드시 RS + 닉네임을 적어주세요. (예: RS도현)
        </p>

        <FeedbackSection open={open} />

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

function StarPicker({
  rating,
  onPick,
}: {
  rating: number;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`별점 ${n}`}
          aria-checked={rating === n}
          role="radio"
          onClick={() => onPick(n)}
          className={`text-2xl leading-none transition ${
            n <= rating ? "text-amber-300" : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

/** 후기/피드백 — login-required. Resolves the player when the modal opens. */
function FeedbackSection({ open }: { open: boolean }) {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve login state each time the modal opens (a guest may have logged in).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchMe()
      .then((me) => {
        if (!alive) return;
        setLoggedIn(true);
        setNickname(me.nickname);
      })
      .catch(() => alive && setLoggedIn(false));
    return () => {
      alive = false;
    };
  }, [open]);

  async function onSubmit() {
    if (submitting) return;
    setError(null);
    if (body.trim().length === 0) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    const err = await submitFeedback({
      body: body.trim(),
      rating: rating > 0 ? rating : null,
    });
    setSubmitting(false);
    if (err) {
      setError(err === "login_required" ? "로그인이 필요합니다." : "제출에 실패했습니다.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
      <p className="text-sm font-semibold text-zinc-100">후기 · 피드백 남기기</p>

      {done ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-3 text-sm text-emerald-200">
          소중한 의견 감사합니다! 개발에 참고하겠습니다.
        </p>
      ) : loggedIn === false ? (
        <p className="text-sm text-zinc-400">
          후기는 로그인 후 남길 수 있어요.{" "}
          <a href="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
            로그인하기 →
          </a>
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            {loggedIn ? `${nickname} 님으로 작성됩니다.` : "불러오는 중…"}
          </p>
          <StarPicker rating={rating} onPick={setRating} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="게임에 대한 후기나 개선 의견을 자유롭게 적어주세요."
            rows={3}
            maxLength={2000}
            disabled={loggedIn !== true}
            className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 disabled:opacity-50"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="button"
            onClick={onSubmit}
            disabled={loggedIn !== true || submitting}
            className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? "제출 중…" : "후기 제출"}
          </button>
        </>
      )}
    </div>
  );
}
