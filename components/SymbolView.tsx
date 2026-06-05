import type { SymbolType } from "@/types";
import { SYMBOL_EMOJI } from "@/data/symbols";

const NUMBER_SYMBOLS = new Set<SymbolType>(["seven", "zero", "four"]);

const NUMBER_STYLE: Record<string, string> = {
  seven: "text-amber-300 border-amber-400/50 bg-amber-500/10",
  zero: "text-zinc-300 border-zinc-500/50 bg-zinc-700/30",
  four: "text-rose-300 border-rose-400/50 bg-rose-500/10",
};

type Size = "sm" | "md" | "lg";

const SIZE_BOX: Record<Size, string> = {
  sm: "h-8 w-8 text-lg",
  md: "h-12 w-12 text-2xl",
  lg: "h-20 w-16 text-4xl sm:h-24 sm:w-20 sm:text-5xl",
};

/**
 * Renders a single slot symbol. Emoji symbols render directly; number
 * symbols (7/0/4) render as styled monospace badges so they read as
 * intentional slot faces.
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
  const glyph = SYMBOL_EMOJI[symbol];

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
      {glyph}
    </span>
  );
}
