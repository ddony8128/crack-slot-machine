"use client";

import { useEffect, useState } from "react";

/**
 * One-time intro shown on a mode's FIRST entry (spec §16). Remembers dismissal
 * in localStorage per `storageKey`, so it appears once and never blocks repeat
 * visits. Renders nothing until the effect confirms it hasn't been seen (avoids
 * an SSR/first-paint flash).
 */
export default function ModeIntro({
  storageKey,
  title,
  lines,
}: {
  storageKey: string;
  title: string;
  lines: string[];
}) {
  const [show, setShow] = useState(false);
  const key = `rule-slot-intro-${storageKey}`;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(key)) setShow(true);
    } catch {
      // localStorage unavailable (private mode etc.) — just skip the intro.
    }
  }, [key]);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      // ignore — worst case the intro shows again next visit.
    }
    setShow(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 안내`}
    >
      <div className="panel-pop w-full max-w-sm space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-center">
        <h2 className="text-xl font-black tracking-tight text-emerald-300">
          {title}
        </h2>
        <div className="space-y-2 text-sm leading-relaxed text-zinc-300">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400"
        >
          확인
        </button>
      </div>
    </div>
  );
}
