import type { EventRow } from '@/lib/db/types';

/** Thrown by admin API helpers; `code` is the server's error string. */
export class AdminApiError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'AdminApiError';
  }
}

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

/** POST /api/admin/login. Resolves on success, throws AdminApiError otherwise. */
export async function adminLogin(password: string): Promise<void> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new AdminApiError(await errorCode(res));
}

/** POST /api/admin/logout. */
export async function adminLogout(): Promise<void> {
  const res = await fetch('/api/admin/logout', { method: 'POST' });
  if (!res.ok) throw new AdminApiError(await errorCode(res));
}

/** GET /api/admin/events (no-store). */
export async function fetchAdminEvents(): Promise<EventRow[]> {
  const res = await fetch('/api/admin/events', { cache: 'no-store' });
  if (!res.ok) throw new AdminApiError(await errorCode(res));
  const body = (await res.json()) as { events: EventRow[] };
  return body.events;
}

/** POST /api/admin/events — create a new event. */
export async function createAdminEvent(input: {
  slug: string;
  title: string;
  description?: string;
}): Promise<EventRow> {
  const res = await fetch('/api/admin/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AdminApiError(await errorCode(res));
  const body = (await res.json()) as { event: EventRow };
  return body.event;
}

/** PATCH /api/admin/events/[slug] — edit title/description. */
export async function updateAdminEvent(
  slug: string,
  input: { title?: string; description?: string | null },
): Promise<EventRow> {
  const res = await fetch(`/api/admin/events/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AdminApiError(await errorCode(res));
  const body = (await res.json()) as { event: EventRow };
  return body.event;
}

/** POST /api/admin/events/[slug]/active — toggle active state. */
export async function setAdminEventActive(
  slug: string,
  active: boolean,
): Promise<EventRow> {
  const res = await fetch(
    `/api/admin/events/${encodeURIComponent(slug)}/active`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    },
  );
  if (!res.ok) throw new AdminApiError(await errorCode(res));
  const body = (await res.json()) as { event: EventRow };
  return body.event;
}
