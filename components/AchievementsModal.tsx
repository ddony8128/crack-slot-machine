"use client";

import Modal from "@/components/Modal";
import { ACHIEVEMENT_META } from "@/data/achievements";
import { ACHIEVEMENT_KEYS } from "@/types";

/**
 * Static reference list of all BLACKHAVEN achievements (title + condition).
 * No per-player unlock state — this is shown from the start screen so players
 * know what they can chase. Built on the shared Modal overlay.
 */
export default function AchievementsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} ariaLabel="업적" maxWidthClass="max-w-lg">
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
        <h2 className="text-lg font-black tracking-tight text-amber-300">
          업적
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
        >
          닫기 (Esc)
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <ul className="space-y-2.5">
          {ACHIEVEMENT_KEYS.map((key) => {
            const meta = ACHIEVEMENT_META[key];
            return (
              <li
                key={key}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
              >
                <p className="text-sm font-bold text-amber-300 horror-glow">
                  {meta.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-zinc-400">
                  {meta.condition}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
