import { request } from './client';
import type {
  Collaborator, Item, Label, Note, Project, Reminder,
  Section, Snapshot, TodoistUser, Workspace,
} from '@/domain/types';

/** The resource types the app reads. Anything else Todoist offers is ignored. */
export const SYNC_RESOURCE_TYPES = [
  'items', 'projects', 'sections', 'labels', 'notes',
  'reminders', 'user', 'collaborators', 'workspaces',
] as const;

export interface SyncResponse {
  sync_token: string;
  full_sync: boolean;
  items?: Item[];
  projects?: Project[];
  sections?: Section[];
  labels?: Label[];
  notes?: Note[];
  reminders?: Reminder[];
  collaborators?: Collaborator[];
  workspaces?: Workspace[];
  user?: TodoistUser;
  temp_id_mapping?: Record<string, string>;
  sync_status?: Record<string, 'ok' | { error_code: number; error: string }>;
}

/**
 * Reads from Todoist.
 *
 * Passing `*` asks for everything; passing the token from the previous call
 * asks only for what changed since. The caller keeps the returned token.
 */
export async function sync(syncToken: string, signal?: AbortSignal): Promise<SyncResponse> {
  return request<SyncResponse>('/sync', {
    method: 'POST',
    form: {
      sync_token: syncToken,
      resource_types: JSON.stringify(SYNC_RESOURCE_TYPES),
    },
    signal,
  });
}

type Keyed = { id: string; is_deleted?: boolean };

/**
 * Folds a sync response into the snapshot.
 *
 * A full sync replaces a collection outright. An incremental one merges, and
 * removes anything Todoist marked deleted, so the local copy never drifts.
 */
function mergeCollection<T extends Keyed>(
  current: Record<string, T>,
  incoming: T[] | undefined,
  fullSync: boolean,
): Record<string, T> {
  if (!incoming) return fullSync ? {} : current;

  const next: Record<string, T> = fullSync ? {} : { ...current };
  for (const entry of incoming) {
    if (entry.is_deleted) delete next[entry.id];
    else next[entry.id] = entry;
  }
  return next;
}

export function applySync(snapshot: Snapshot, response: SyncResponse): Snapshot {
  const full = response.full_sync;
  return {
    items: mergeCollection(snapshot.items, response.items, full),
    projects: mergeCollection(snapshot.projects, response.projects, full),
    sections: mergeCollection(snapshot.sections, response.sections, full),
    labels: mergeCollection(snapshot.labels, response.labels, full),
    notes: mergeCollection(snapshot.notes, response.notes, full),
    reminders: mergeCollection(snapshot.reminders, response.reminders, full),
    collaborators: mergeCollection(snapshot.collaborators, response.collaborators, full),
    workspaces: mergeCollection(snapshot.workspaces, response.workspaces, full),
    user: response.user ?? snapshot.user,
    syncToken: response.sync_token,
    syncedAt: Date.now(),
  };
}
