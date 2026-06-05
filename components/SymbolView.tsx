import Image from "next/image";
import type { SymbolType } from "@/types";

const NUMBER_SYMBOLS = new Set<SymbolType>(["seven", "zero", "four"]);

const NUMBER_STYLE: Record<string, string> = {
  seven: "text-amber-300 border-amber-400/50 bg-amber-500/10",
  zero: "text-zinc-300 border-zinc-500/50 bg-zinc-700/30",
  four: "text-rose-300 border-rose-400/50 bg-rose-500/10",
};

const NUMBER_GLYPH: Record<string, string> = {
  seven: "7",
  zero: "0",
  four: "4",
};

/** Bundled Twemoji SVGs (jdecked/twemoji) served from /public/symbols. */
const SYMBOL_SVG: Partial<Record<SymbolType, string>> = {
  cherry: "/symbols/cherry.svg",
  lemon: "/symbols/lemon.svg",
  grape: "/symbols/grape.svg",
  diamond: "/symbols/diamond.svg",
  ruby: "/symbols/ruby.svg",
  sapphire: "/symbols/sapphire.svg",
};

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_BOX: Record<Size, string> = {
  sm: "h-8 w-8 text-lg",
  md: "h-12 w-12 text-2xl",
  lg: "h-20 w-16 text-4xl sm:h-24 sm:w-20 sm:text-5xl",
  xl: "h-28 w-24 text-6xl sm:h-36 sm:w-28 sm:text-7xl",
};

/** Pixel dimensions for the rendered Twemoji image per size variant. */
const SIZE_IMG: Record<Size, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 72,
};

/**
 * Renders a single slot symbol. Pictorial symbols render as crisp bundled
 * Twemoji SVGs; number symbols (7/0/4) render as styled monospace badges so
 * they read as intentional slot faces.
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
  const svg = SYMBOL_SVG[symbol];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border ${
        SIZE_BOX[size]
      } ${
        isNumber
          ? `font-mono font-bold ${NUMBER_STYLE[symbol]}`
          : "border-zinc-700/60 bg-zinc-800/40"
      } ${className}`}
    >
      {isNumber || !svg ? (
        NUMBER_GLYPH[symbol] ?? symbol
      ) : (
        <Image
          src={svg}
          alt={symbol}
          width={SIZE_IMG[size]}
          height={SIZE_IMG[size]}
          className="h-3/4 w-3/4 object-contain"
          draggable={false}
          unoptimized
        />
      )}
    </span>
  );
}
