"use client";

import Modal from "@/components/Modal";
import SymbolView from "@/components/SymbolView";
import { FRUITS, GEMS } from "@/data/symbols";
import type { SymbolType } from "@/types";

const STEPS = [
  "매 스핀 전 규칙 카드 1장을 고릅니다.",
  "고른 규칙을 슬롯에 장착하거나 가방에 보관합니다.",
  "레버를 당기면 위에서 아래 순서로 규칙이 적용됩니다.",
  "총 7번의 스핀으로 최고 점수를 노리세요.",
];

// 심볼 3세트 — 이미지와 함께 간단한 설명.
const SYMBOL_SETS: { title: string; desc: string; symbols: SymbolType[] }[] = [
  {
    title: "신체 (손·발·눈)",
    desc: "같은 신체끼리 모으면 족보 점수, 세 종류를 다 모으면 보너스.",
    symbols: FRUITS,
  },
  {
    title: "괴물 (좀비·흡혈귀·유령)",
    desc: "같은 괴물끼리 모으면 족보 점수, 세 종류를 다 모으면 보너스.",
    symbols: GEMS,
  },
  {
    title: "숫자 (7·0·4)",
    desc: "7은 잭팟 점수, 0은 점수 없음, 4는 감점입니다.",
    symbols: ["seven", "zero", "four"],
  },
];

/**
 * Game-start instructions modal. Shown every time a new game begins (no
 * "don't show again"). A "시작하기" button closes it.
 */
export default function IntroModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="룰 슬롯츠 하는 법">
      <header className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-lg font-black tracking-tight">
          <span className="text-emerald-400">룰 슬롯츠</span> 하는 법
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ol className="space-y-2.5">
          {STEPS.map((text, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-sm font-bold text-amber-300 ring-1 ring-zinc-700">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm text-zinc-200">{text}</span>
            </li>
          ))}
        </ol>

        {/* 심볼 세트 안내 (이미지 포함) */}
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-bold text-zinc-300">심볼</h3>
          {SYMBOL_SETS.map((set) => (
            <div
              key={set.title}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="flex shrink-0 gap-1">
                {set.symbols.map((s) => (
                  <SymbolView key={s} symbol={s} size="sm" />
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-100">{set.title}</p>
                <p className="text-xs leading-snug text-zinc-400">{set.desc}</p>
              </div>
            </div>
          ))}
          <p className="pt-1 text-sm leading-snug text-zinc-300">
            7과 족보, 보너스를 조합해 높은 점수를 만들어보세요.
          </p>
        </div>
      </div>

      <footer className="border-t border-zinc-800 px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-base font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          시작하기
        </button>
      </footer>
    </Modal>
  );
}
