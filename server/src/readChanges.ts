import { BadRequest } from './errors';
import type { Repo } from './repo';
import { RESOURCE_TYPES, type ResourceType, type SyncResponse } from './wire';

export type RequestedType = ResourceType | 'user';

const SUPPORTED: readonly RequestedType[] = [...RESOURCE_TYPES, 'user'];

/** Sync tokens are the user's revision number. "*" or anything unreadable means "send everything". */
export function parseSyncToken(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** Accepts the JSON array Todoist takes, either as a form string or already parsed. */
export function parseResourceTypes(raw: unknown): RequestedType[] {
  if (raw === undefined) return [...SUPPORTED];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequest('resource_types must be a JSON array');
    }
  }
  if (!Array.isArray(parsed)) throw new BadRequest('resource_types must be a JSON array');
  if (parsed.includes('all')) return [...SUPPORTED];
  // Types this server does not keep are ignored, as Todoist ignores unknown ones.
  return SUPPORTED.filter((type) => parsed.includes(type));
}

type Row = { id: string; is_deleted?: boolean; checked?: boolean };

/**
 * What changed since `since`, or everything when `since` is null.
 *
 * A full read leaves out deleted rows and completed tasks, and answers every
 * requested type even when it is empty: the app clears any collection a full
 * response does not mention. An incremental read includes deletions and
 * completions so the app can drop them.
 */
export async function readChanges(
  repo: Repo,
  userId: string,
  since: number | null,
  types: RequestedType[],
): Promise<SyncResponse> {
  const user = await repo.getUser(userId);
  const response: SyncResponse = { sync_token: String(user.rev), full_sync: since === null };
  const out = response as unknown as Record<string, unknown>;

  for (const type of types) {
    if (type === 'user') {
      if (since === null || user.userRev > since) response.user = user.data;
      continue;
    }
    if (since === null) {
      const rows = await repo.list<Row>(userId, type);
      out[type] = rows.filter((row) => !row.is_deleted && !(type === 'items' && row.checked));
    } else {
      out[type] = await repo.changedSince<Row>(userId, type, since);
    }
  }
  return response;
}
