"use client";

import { useState } from "react";
import type { SymbolType } from "@/types";

const NUMBER_SYMBOLS = new Set<SymbolType>(["seven", "zero", "four"]);

/**
 * Number badge tints (BLACKHAVEN horror theme):
 *   7 = blood/gold glow, 4 = red glitch tint, 0 = pale grey.
 * Kept tasteful and minimal.
 */
const NUMBER_STYLE: Record<string, string> = {
  seven:
    "text-amber-200 border-amber-400/60 bg-gradient-to-b from-amber-500/15 to-red-900/20 [text-shadow:0_0_8px_rgba(245,197,24,0.7),0_0_4px_rgba(190,18,60,0.6)]",
  zero: "text-zinc-400 border-zinc-600/50 bg-zinc-800/40 [text-shadow:0_0_4px_rgba(161,161,170,0.4)]",
  four: "text-rose-400 border-rose-500/60 bg-rose-900/25 [text-shadow:1px_0_2px_rgba(255,0,64,0.8),-1px_0_2px_rgba(0,255,255,0.5)]",
};

const NUMBER_GLYPH: Record<string, string> = {
  seven: "7",
  zero: "0",
  four: "4",
};

/**
 * BLACKHAVEN horror symbol images (WebP, transparent).
 *
 * EXPECTED ASSET FILES — produce these (recommended 512×512 px, transparent PNG/WebP):
 *   /public/symbols/blackhaven/hand.webp     (cherry  → 손)
 *   /public/symbols/blackhaven/foot.webp     (lemon   → 발)
 *   /public/symbols/blackhaven/eye.webp      (grape   → 눈)
 *   /public/symbols/blackhaven/zombie.webp   (diamond → 좀비)
 *   /public/symbols/blackhaven/vampire.webp  (ruby    → 흡혈귀)
 *   /public/symbols/blackhaven/ghost.webp    (sapphire→ 유령)
 *
 * These files do NOT exist yet — see SYMBOL_NAME fallback below: if an image
 * 404s, an onError handler swaps to a styled Korean short-name so the UI never
 * looks broken.
 */
const SYMBOL_IMG: Partial<Record<SymbolType, string>> = {
  cherry: "/symbols/blackhaven/hand.webp",
  lemon: "/symbols/blackhaven/foot.webp",
  grape: "/symbols/blackhaven/eye.webp",
  diamond: "/symbols/blackhaven/zombie.webp",
  ruby: "/symbols/blackhaven/vampire.webp",
  sapphire: "/symbols/blackhaven/ghost.webp",
};

/** Korean short-name fallback rendered when an image is missing / 404s. */
const SYMBOL_NAME: Partial<Record<SymbolType, string>> = {
  cherry: "손",
  lemon: "발",
  grape: "눈",
  diamond: "좀비",
  ruby: "흡혈귀",
  sapphire: "유령",
};

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_BOX: Record<Size, string> = {
  sm: "h-8 w-8 text-lg",
  md: "h-12 w-12 text-2xl",
  lg: "h-20 w-16 text-4xl sm:h-24 sm:w-20 sm:text-5xl",
  xl: "h-28 w-24 text-6xl sm:h-36 sm:w-28 sm:text-7xl",
};

/** Smaller text scale for the Korean-name fallback so multi-char names fit. */
const SIZE_FALLBACK_TEXT: Record<Size, string> = {
  sm: "text-[0.5rem]",
  md: "text-[0.65rem]",
  lg: "text-xs sm:text-sm",
  xl: "text-sm sm:text-base",
};

/**
 * Renders a single slot symbol. Pictorial symbols render as horror WebP images;
 * number symbols (7/0/4) render as styled monospace badges with a horror tint so
 * they read as intentional slot faces.
 *
 * FALLBACK APPROACH: pictorial symbols use a plain <img> (not next/image) with an
 * onError handler. The project's next/image is configured `unoptimized`, so a
 * plain <img> renders byte-identically but lets us catch a 404 and swap to a
 * styled Korean short-name (손/발/눈/좀비/흡혈귀/유령). This keeps the layout box
 * intact and prevents broken-image icons while the .webp assets don't yet exist.
 *
 * Optional `className` lets callers attach motion classes (e.g. reel-land,
 * reel-flash, reel-rolling) without changing the visual base.
 */
export default function SymbolView({
  symbol,
  size = "md",
  className = "",
}: {
  symbol: SymbolType;
  size?: Size;
  className?: string;
}) {
  const isNumber = NUMBER_SYMBOLS.has(symbol);
  const img = SYMBOL_IMG[symbol];
  const [imgFailed, setImgFailed] = useState(false);

  const showFallback = !isNumber && (!img || imgFailed);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border ${
        SIZE_BOX[size]
      } ${
        isNumber
          ? `font-mono font-bold ${NUMBER_STYLE[symbol]}`
          : "border-zinc-700/60 bg-zinc-900/50"
      } ${className}`}
    >
      {isNumber ? (
        NUMBER_GLYPH[symbol] ?? symbol
      ) : showFallback ? (
        <span
          className={`font-semibold tracking-tight text-zinc-200 horror-glow ${SIZE_FALLBACK_TEXT[size]}`}
        >
          {SYMBOL_NAME[symbol] ?? symbol}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- plain <img> for onError fallback (assets may 404)
        <img
          src={img}
          alt={SYMBOL_NAME[symbol] ?? symbol}
          className="h-3/4 w-3/4 object-contain"
          draggable={false}
          onError={() => setImgFailed(true)}
        />
      )}
    </span>
  );
}
