"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  changePassword,
  deleteAccount,
  AuthApiError,
} from "@/lib/client/authApi";

type Props = {
  nickname: string;
  contactType: "email" | "phone";
  contactValue: string;
};

const PW_ERRORS: Record<string, string> = {
  wrong_password: "현재 비밀번호가 올바르지 않습니다.",
  weak_password: "새 비밀번호는 8자 이상이어야 합니다.",
  unauthorized: "로그인이 필요합니다.",
};

const DELETE_ERRORS: Record<string, string> = {
  wrong_password: "비밀번호가 올바르지 않습니다.",
  unauthorized: "로그인이 필요합니다.",
};

function messageFor(
  table: Record<string, string>,
  err: unknown,
  fallback: string,
): string {
  const code = err instanceof AuthApiError ? err.code : "unknown";
  return table[code] ?? fallback;
}

const CONTACT_LABEL: Record<Props["contactType"], string> = {
  email: "이메일",
  phone: "전화번호",
};

export default function AccountSettings({
  nickname,
  contactType,
  contactValue,
}: Props) {
  const router = useRouter();

  // ── 비밀번호 변경 ─────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwSubmitting) return;
    setPwError(null);
    setPwDone(false);
    if (newPw.length < 8) {
      setPwError("새 비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setPwSubmitting(true);
    try {
      await changePassword(currentPw, newPw);
      setPwDone(true);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setPwError(
        messageFor(PW_ERRORS, err, "비밀번호 변경에 실패했습니다. 다시 시도해 주세요."),
      );
    } finally {
      setPwSubmitting(false);
    }
  }

  // ── 탈퇴하기 ──────────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePw);
      // Account is gone; leave the member area entirely.
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleteError(
        messageFor(DELETE_ERRORS, err, "탈퇴에 실패했습니다. 다시 시도해 주세요."),
      );
      setDeleteSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none transition focus:border-emerald-400";

  return (
    <div className="flex w-full flex-col gap-6">
      {/* 계정 정보 (read-only) */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
        <h2 className="text-lg font-bold text-zinc-100">계정 정보</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">닉네임</dt>
            <dd className="max-w-[60%] truncate font-semibold text-zinc-200">
              {nickname}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-zinc-500">{CONTACT_LABEL[contactType]}</dt>
            <dd className="max-w-[60%] truncate font-mono text-zinc-300">
              {contactValue}
            </dd>
          </div>
        </dl>
      </section>

      {/* 비밀번호 변경 */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-5">
        <h2 className="text-lg font-bold text-zinc-100">비밀번호 변경</h2>
        <form className="mt-3 flex flex-col gap-3" onSubmit={onChangePassword}>
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="현재 비밀번호"
            autoComplete="current-password"
            className={inputClass}
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="새 비밀번호 (8자 이상)"
            autoComplete="new-password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pwSubmitting}
            className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
          >
            {pwSubmitting ? "변경 중…" : "비밀번호 변경"}
          </button>
          {pwError && (
            <p className="text-center text-sm text-rose-400">{pwError}</p>
          )}
          {pwDone && (
            <p className="text-center text-sm text-emerald-400">
              비밀번호가 변경되었습니다.
            </p>
          )}
        </form>
      </section>

      {/* 탈퇴하기 */}
      <section className="rounded-2xl border border-rose-500/40 bg-rose-500/5 px-5 py-5">
        <h2 className="text-lg font-bold text-rose-300">탈퇴하기</h2>
        <p className="mt-2 text-sm text-zinc-400">
          탈퇴하면 계정 정보가 삭제되고{" "}
          <span className="font-semibold text-rose-300">
            랭킹 기록은 익명 처리
          </span>
          됩니다. 이 작업은{" "}
          <span className="font-semibold text-rose-300">복구할 수 없습니다.</span>
        </p>

        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => {
              setDeleteOpen(true);
              setDeleteError(null);
            }}
            className="mt-4 w-full rounded-xl border border-rose-500/50 bg-transparent px-6 py-3 text-base font-bold text-rose-300 transition hover:bg-rose-500/10"
          >
            탈퇴하기
          </button>
        ) : (
          <form className="mt-4 flex flex-col gap-3" onSubmit={onDeleteAccount}>
            <p className="text-sm text-zinc-300">
              계속하려면 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              value={deletePw}
              onChange={(e) => setDeletePw(e.target.value)}
              placeholder="비밀번호"
              autoComplete="current-password"
              autoFocus
              className={inputClass}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeletePw("");
                  setDeleteError(null);
                }}
                disabled={deleteSubmitting}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-base font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={deleteSubmitting || deletePw.length === 0}
                className="flex-1 rounded-xl bg-rose-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
              >
                {deleteSubmitting ? "처리 중…" : "영구 탈퇴"}
              </button>
            </div>
            {deleteError && (
              <p className="text-center text-sm text-rose-400">{deleteError}</p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
