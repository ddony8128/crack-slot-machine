/**
 * Tiny client-only sound-effects manager.
 *
 * - Lazily constructs/reuses one HTMLAudioElement per sound key.
 * - Files live in /public/sounds/<key>.mp3. If a file is missing or playback
 *   fails, this SILENTLY no-ops (every .play() is wrapped in try/catch and the
 *   returned promise's .catch()).
 * - Mute state is persisted to localStorage and respected by play().
 * - SSR-safe: all window/Audio access is guarded by `typeof window`. Only import
 *   this from client components.
 */

export type SoundKey = "lever" | "spin" | "rule" | "score" | "jackpot";

const STORAGE_KEY = "rule-slot-muted";
const EXT = "mp3";

const audioCache: Partial<Record<SoundKey, HTMLAudioElement>> = {};

// In-memory mirror of the persisted mute flag so getMuted() is cheap and works
// even before any localStorage read.
let muted = false;
let initialized = false;

function ensureInit(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    muted = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // localStorage may be unavailable (privacy mode); default to unmuted.
  }
}

export function getMuted(): boolean {
  ensureInit();
  return muted;
}

export function setMuted(value: boolean): void {
  ensureInit();
  muted = value;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore persistence failures
  }
}

function getAudio(key: SoundKey): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  let el = audioCache[key];
  if (!el) {
    try {
      el = new Audio(`/sounds/${key}.${EXT}`);
      el.preload = "auto";
      audioCache[key] = el;
    } catch {
      return null;
    }
  }
  return el;
}

/**
 * Play a sound effect by key. No-ops when muted, on the server, or if the file
 * is missing / playback is blocked. Never throws.
 */
export function play(key: SoundKey): void {
  ensureInit();
  if (muted || typeof window === "undefined") return;
  const el = getAudio(key);
  if (!el) return;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        /* missing file / autoplay blocked — stay silent */
      });
    }
  } catch {
    /* stay silent */
  }
}
