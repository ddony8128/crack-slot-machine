"use client";

import { useEffect, useState } from "react";
import { getMuted, setMuted } from "@/lib/sound";

/**
 * Fixed top-right mute toggle (🔊 / 🔇). Persists to localStorage via lib/sound.
 * Mounted globally from app/layout.tsx so it appears on every screen.
 */
export default function SoundToggle() {
  // Start unmuted on both server and first client render to avoid hydration
  // mismatch, then sync from persisted state after mount.
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMutedState(getMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={muted}
      aria-label={muted ? "소리 켜기" : "소리 끄기"}
      title={muted ? "소리 켜기" : "소리 끄기"}
      className="fixed right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/60 text-lg text-zinc-200 shadow-lg backdrop-blur-sm transition hover:bg-zinc-800"
    >
      <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
