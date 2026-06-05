"use client";

import type { RankingRecord } from "@/types";

type RankingPanelProps = {
  records: RankingRecord[];
  highlightId?: string;
  limit?: number;
  onReset?: () => void;
};

export default function RankingPanel({
  records,
  highlightId,
  limit,
  onReset,
}: RankingPanelProps) {
  const visible =
    typeof limit === "number" ? records.slice(0, limit) : records;

  const handleReset = () => {
    if (!onReset) return;
    if (window.confirm("랭킹 기록을 모두 삭제할까요?")) {
      onReset();
    }
  };

  return (
    <div className="w-full">
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500">
          아직 기록이 없습니다
        </div>
      ) : (
        <ol className="space-y-1">
          {visible.map((record, index) => {
            const rank = index + 1;
            const highlighted = record.id === highlightId;
            return (
              <li
                key={record.id}
                className={[
                  "flex items-center justify-between rounded-xl border px-4 py-2 text-sm",
                  highlighted
                    ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400"
                    : "border-zinc-800 bg-zinc-900/60",
                ].join(" ")}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-center font-mono font-bold text-amber-300">
                    {rank}
                  </span>
                  <span className="truncate font-semibold text-zinc-200">
                    {record.nickname}
                  </span>
                </span>
                <span className="font-mono font-bold text-emerald-300">
                  {record.score}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {onReset && (
        <button
          type="button"
          onClick={handleReset}
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:bg-zinc-800/60 hover:text-zinc-200"
        >
          랭킹 초기화
        </button>
      )}
    </div>
  );
}
