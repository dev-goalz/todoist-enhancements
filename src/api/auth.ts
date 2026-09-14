/**
 * Where the credential comes from.
 *
 * Today the app holds a personal API token, entered once and kept on this
 * device. Publishing a multi-user version means swapping the implementation
 * behind this interface for an OAuth flow with a server-side secret, and
 * nothing outside this file needs to change.
 */

const TOKEN_KEY = 'tde.token';

export interface AuthProvider {
  /** The bearer token to send, or null when the app is not connected. */
  getToken(): Promise<string | null>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
}

class PersonalTokenAuth implements AuthProvider {
  private token: string | null;

  constructor() {
    this.token = readStoredToken();
  }

  async getToken(): Promise<string | null> {
    return this.token;
  }

  isConnected(): boolean {
    return this.token !== null && this.token.length > 0;
  }

  async set(token: string): Promise<void> {
    this.token = token.trim();
    try {
      localStorage.setItem(TOKEN_KEY, this.token);
    } catch {
      // A browser with storage blocked still works for the session in memory.
    }
  }

  async disconnect(): Promise<void> {
    this.token = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clear */
    }
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const auth = new PersonalTokenAuth();

/** Rejects anything that cannot be a Todoist personal token before a call is made. */
export function looksLikeToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(value.trim());
}
