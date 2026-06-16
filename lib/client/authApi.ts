/** Thrown by auth API helpers; `code` is the server's error string. */
export class AuthApiError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = 'AuthApiError';
  }
}

async function errorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `http_${res.status}`;
}

export type AuthPlayer = { id: string; nickname: string };
export type MePlayer = {
  id: string;
  nickname: string;
  contactType: 'email' | 'phone';
  /** True when the player carries the 후원자(supporter) badge. */
  supporterBadge: boolean;
};

export type SignupInput = {
  nickname: string;
  /** At least one of email/phone is required (validated server-side). */
  email?: string;
  phone?: string;
  password: string;
  agree: boolean;
};

/** POST /api/auth/signup. Resolves with the new player, throws AuthApiError. */
export async function signup(input: SignupInput): Promise<AuthPlayer> {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
  const body = (await res.json()) as { player: AuthPlayer };
  return body.player;
}

/** POST /api/auth/login. Resolves with the player, throws AuthApiError. */
export async function login(
  nickname: string,
  password: string,
): Promise<AuthPlayer> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname, password }),
  });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
  const body = (await res.json()) as { player: AuthPlayer };
  return body.player;
}

/** POST /api/auth/logout. */
export async function logout(): Promise<void> {
  const res = await fetch('/api/auth/logout', { method: 'POST' });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
}

/** GET /api/auth/me (no-store). Resolves with the player, throws AuthApiError. */
export async function fetchMe(): Promise<MePlayer> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
  const body = (await res.json()) as { player: MePlayer };
  return body.player;
}

/** POST /api/auth/password. Resolves on success, throws AuthApiError. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
}

/** POST /api/auth/delete (탈퇴). Resolves on success, throws AuthApiError. */
export async function deleteAccount(password: string): Promise<void> {
  const res = await fetch('/api/auth/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new AuthApiError(await errorCode(res));
}
