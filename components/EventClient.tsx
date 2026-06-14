"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { startRun } from "@/lib/client/api";
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import ResultScreen from "@/components/ResultScreen";
import IntroModal from "@/components/IntroModal";
import { playBgm, stopBgm } from "@/lib/sound";

type Props = { slug: string; isActive: boolean };

function startErrorMessage(code: string): string {
  if (code === "event_inactive") return "비활성화된 이벤트입니다.";
  if (code === "not_found") return "존재하지 않는 이벤트입니다.";
  if (code === "nickname_not_whitelisted")
    return "등록되지 않은 닉네임입니다. 스태프에게 문의해주세요.";
  return "게임을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export default function EventClient({ slug, isActive }: Props) {
  const status = useGameStore((s) => s.status);
  const nickname = useGameStore((s) => s.nickname);
  const beginRun = useGameStore((s) => s.beginRun);
  const startGame = useGameStore((s) => s.startGame);
  const reset = useGameStore((s) => s.reset);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Shown every time a new game begins (no "don't show again"). Set true the
  // moment we leave the 'start' screen for a fresh run; the player dismisses it
  // with "시작하기".
  const [showIntro, setShowIntro] = useState(false);

  // The store is a module singleton that survives client navigations, so reset
  // to a clean 'start' state whenever this event page mounts.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    reset();
    // Stop any lingering BGM (the singleton store survives navigations).
    stopBgm();
    // Belt-and-suspenders: also stop BGM if this component unmounts (navigation).
    return () => stopBgm();
  }, [reset]);

  // Stop the BGM once the run is over so it doesn't keep looping on the result screen.
  useEffect(() => {
    if (status === "finished" || status === "start") stopBgm();
  }, [status]);

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await startRun(slug, nickname);
      beginRun(run.seed, run.runId, slug);
      startGame();
      // This runs inside a click handler (user gesture), so autoplay is allowed.
      playBgm();
      // Game is about to begin: show the instructions before the player acts.
      setShowIntro(true);
    } catch (err) {
      setStartError(startErrorMessage(err instanceof Error ? err.message : ""));
    } finally {
      setStarting(false);
    }
  }

  if (status === "finished") return <ResultScreen slug={slug} />;
  if (status === "start")
    return (
      <StartScreen
        slug={slug}
        isActive={isActive}
        starting={starting}
        startError={startError}
        onStart={handleStart}
      />
    );
  return (
    <>
      <GameScreen />
      <IntroModal open={showIntro} onClose={() => setShowIntro(false)} />
    </>
  );
}
