import Image from "next/image";
import type { SymbolType } from "@/types";
import { SYMBOL_EMOJI } from "@/data/symbols";
import { SYMBOL_SETS } from "@/lib/symbols/sets";

const NUMBER_SYMBOLS = new Set<SymbolType>(["seven", "zero", "four"]);

/**
 * Korean display name per symbol id, sourced from SYMBOL_SETS (single source of
 * truth). Used for the box title/aria-label so symbols that share a similar emoji
 * — notably the three cats (치즈냥/턱시도냥/삼색냥) — are always identifiable on
 * hover and to screen readers. Hybrids fall back to their own friendly names.
 */
const SYMBOL_NAME: Partial<Record<SymbolType, string>> = (() => {
  const map: Partial<Record<SymbolType, string>> = {};
  for (const set of SYMBOL_SETS) {
    for (const s of set.symbols) map[s.id as SymbolType] = s.name;
  }
  map.zombie_cat = "좀비고양이";
  map.ghost_cat = "유령고양이";
  return map;
})();

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
  // Mobile base kept small enough that five reels fit one row on a ~360px phone
  // (5×52 + gaps ≈ 284px); scales up from sm:.
  lg: "h-[68px] w-[52px] text-3xl sm:h-24 sm:w-20 sm:text-5xl",
  xl: "h-24 w-[58px] text-5xl sm:h-36 sm:w-28 sm:text-7xl",
};

/** Pixel dimensions for the rendered Twemoji image per size variant. */
const SIZE_IMG: Record<Size, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 72,
};

/**
 * Renders a single slot symbol. Pictorial symbols with a bundled SVG render as
 * crisp Twemoji SVGs; number symbols (7/0/4) render as styled monospace badges
 * so they read as intentional slot faces. Symbols without a bundled SVG (e.g.
 * the Season 1 cat/vehicle/monster sets) render their emoji from SYMBOL_EMOJI
 * inside the same styled pictorial box, so nothing ever renders blank.
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
  // Korean name (e.g. 치즈냥) for hover/title + a11y. Falls back to the raw id so
  // nothing ever renders nameless.
  const name = SYMBOL_NAME[symbol] ?? symbol;

  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex items-center justify-center rounded-lg border ${
        SIZE_BOX[size]
      } ${
        isNumber
          ? `font-mono font-bold ${NUMBER_STYLE[symbol]}`
          : "border-zinc-700/60 bg-zinc-800/40"
      } ${className}`}
    >
      {isNumber || !svg ? (
        // Number badges use their glyph; emoji-only symbols (no bundled SVG)
        // fall back to SYMBOL_EMOJI so they never render the raw id string.
        NUMBER_GLYPH[symbol] ?? SYMBOL_EMOJI[symbol] ?? symbol
      ) : (
        <Image
          src={svg}
          alt={name}
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
