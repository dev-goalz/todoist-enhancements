import { auth } from './auth';

/**
 * Todoist's cloud, unless the build names another server that speaks the same
 * API. A relative value such as `/api/v1` means the server that hosts the app.
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE || 'https://api.todoist.com/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  /** The token is missing, wrong, or has been revoked. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export class NotConnectedError extends Error {
  constructor() {
    super('No Todoist token is configured.');
    this.name = 'NotConnectedError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Sent as a form body, which is what the sync endpoint expects. */
  form?: Record<string, string>;
  json?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** How many times to retry on 429 or a 5xx. */
  retries?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * One call to Todoist.
 *
 * Honours the `retry_after` the API sends with a 429 rather than guessing, and
 * backs off on server errors. Auth failures are never retried: the token is
 * wrong and trying again cannot fix it.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await auth.getToken();
  if (!token) throw new NotConnectedError();

  const { method = 'GET', form, json, query, signal, retries = 3 } = options;

  // A relative base resolves against the page, so one build works on any host.
  const url = new URL(`${API_BASE}${path}`, globalThis.location?.href);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;

  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  let attempt = 0;
  for (;;) {
    const response = await fetch(url, { method, headers, body, signal });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt >= retries) {
      let parsed: unknown;
      const text = await response.text().catch(() => '');
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = text;
      }
      throw new ApiError(
        `Todoist responded ${response.status}`,
        response.status,
        parsed,
      );
    }

    // The API tells us how long to wait; fall back to exponential backoff.
    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(30_000, 2 ** attempt * 1000);

    await sleep(waitMs);
    attempt += 1;
  }
}
