/** slug: lowercase letters, digits, hyphens, 1–50 chars. */
export const SLUG_RE = /^[a-z0-9-]{1,50}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export const MAX_NICKNAME = 60;

/**
 * Trim, cap at 60 chars, fall back to "Anonymous" when empty. No profanity or
 * content filtering (by design) — only length/whitespace normalization. SQL
 * injection is prevented by using the parameterized query builder, not here.
 */
export function sanitizeNickname(input: unknown): string {
  if (typeof input !== 'string') return 'Anonymous';
  const trimmed = input.trim().slice(0, MAX_NICKNAME);
  return trimmed.length === 0 ? 'Anonymous' : trimmed;
}
