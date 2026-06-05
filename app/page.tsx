"use client";

import { useGameStore } from "@/store/gameStore";
import StartScreen from "@/components/StartScreen";
import GameScreen from "@/components/GameScreen";
import ResultScreen from "@/components/ResultScreen";

export default function Home() {
  const status = useGameStore((s) => s.status);

  if (status === "start") return <StartScreen />;
  if (status === "finished") return <ResultScreen />;
  return <GameScreen />;
}
