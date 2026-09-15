import { API_BASE } from './client';

/**
 * Accounts on a self-hosted server.
 *
 * Todoist has nothing like this: against Todoist the app is given a token.
 * A self-hosted server instead checks an email and password and hands back a
 * token for this device, which the app then uses exactly as it would a
 * Todoist token.
 */

export type AccountErrorCode =
  | 'invalid_email' | 'invalid_name' | 'weak_password' | 'email_taken'
  | 'invalid_credentials' | 'signup_closed' | 'rate_limited'
  /** The server could not be reached, or answered something unexpected. */
  | 'offline';

export class AccountError extends Error {
  constructor(readonly code: AccountErrorCode) {
    super(code);
    this.name = 'AccountError';
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(`${API_BASE}/auth${path}`, globalThis.location?.href), init);
  } catch {
    throw new AccountError('offline');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as { code?: AccountErrorCode } | null;
  if (!response.ok) throw new AccountError(body?.code ?? 'offline');
  return body as T;
}

const post = <T>(path: string, payload: unknown) => call<T>(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export async function fetchAccountConfig(): Promise<{ signup: boolean }> {
  return call('/config');
}

export async function signIn(email: string, password: string): Promise<string> {
  return (await post<{ token: string }>('/login', { email, password })).token;
}

export async function signUp(input: {
  fullName: string; email: string; password: string; lang: string;
}): Promise<string> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (await post<{ token: string }>('/signup', {
    full_name: input.fullName, email: input.email, password: input.password, lang: input.lang, timezone,
  })).token;
}

/** Tells the server this device's token is done with. Never throws: signing out must work offline. */
export async function signOutRemote(token: string): Promise<void> {
  try {
    await call('/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  } catch {
    /* the token is forgotten locally either way */
  }
}
