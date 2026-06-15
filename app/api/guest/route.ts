import { randomUUID } from 'node:crypto';

// POST /api/guest — issue a stateless guest identity (no DB write).
// The id is a fresh UUID; the display name carries a stable 4-digit suffix
// derived from the id so the same guest always renders the same name.
export async function POST() {
  const guestId = randomUUID();
  const suffix = guestSuffix(guestId);
  return Response.json({ guestId, displayName: `게스트-${suffix}` });
}

/** Stable 4-char numeric suffix derived from the uuid's hex digits. */
function guestSuffix(guestId: string): string {
  const hex = guestId.replace(/[^0-9a-f]/gi, '');
  const tail = hex.slice(-4);
  // Map each hex nibble to a decimal digit (0-9) for an all-digits suffix.
  return tail
    .split('')
    .map((c) => (parseInt(c, 16) % 10).toString())
    .join('')
    .padStart(4, '0');
}
