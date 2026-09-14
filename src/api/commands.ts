import { request } from './client';
import type { SyncResponse } from './sync';

/**
 * Writes to Todoist.
 *
 * Every change the app makes is expressed as a sync command and sent through
 * this queue. Commands carry a uuid so Todoist can discard a duplicate if a
 * retry goes through twice, which makes the queue safe to replay after the
 * network comes back.
 */

export interface Command {
  type: string;
  uuid: string;
  args: Record<string, unknown>;
  temp_id?: string;
}

export const newUuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function command(type: string, args: Record<string, unknown>, tempId?: string): Command {
  const cmd: Command = { type, uuid: newUuid(), args };
  if (tempId) {
    cmd.temp_id = tempId;
    cmd.args = { ...args, temp_id: undefined };
  }
  return cmd;
}

/** Todoist accepts up to 100 commands in one call. */
const MAX_COMMANDS_PER_CALL = 100;

export interface CommandResult {
  response: SyncResponse;
  /** Commands Todoist rejected, with the reason it gave. */
  failures: Array<{ uuid: string; error: string }>;
}

export async function sendCommands(
  syncToken: string,
  commands: Command[],
): Promise<CommandResult> {
  if (commands.length === 0) {
    throw new Error('sendCommands called with no commands');
  }

  const batch = commands.slice(0, MAX_COMMANDS_PER_CALL);
  const response = await request<SyncResponse>('/sync', {
    method: 'POST',
    form: {
      sync_token: syncToken,
      resource_types: JSON.stringify(['items', 'projects', 'sections', 'labels', 'notes']),
      commands: JSON.stringify(batch),
    },
  });

  const failures: Array<{ uuid: string; error: string }> = [];
  for (const [uuid, status] of Object.entries(response.sync_status ?? {})) {
    if (status !== 'ok') failures.push({ uuid, error: status.error });
  }

  return { response, failures };
}

/* ---------- The commands the product actually issues ---------- */

export const updateItem = (id: string, args: Record<string, unknown>): Command =>
  command('item_update', { id, ...args });

export const addItem = (args: Record<string, unknown>, tempId: string): Command => {
  const cmd: Command = { type: 'item_add', uuid: newUuid(), args, temp_id: tempId };
  return cmd;
};

export const completeItem = (id: string): Command => command('item_complete', { id });
export const uncompleteItem = (id: string): Command => command('item_uncomplete', { id });
export const deleteItem = (id: string): Command => command('item_delete', { id });

export const moveItem = (
  id: string,
  target: { project_id?: string; section_id?: string | null; parent_id?: string | null },
): Command => command('item_move', { id, ...target });

export const reorderItems = (items: Array<{ id: string; child_order: number }>): Command =>
  command('item_reorder', { items });

export const updateProject = (id: string, args: Record<string, unknown>): Command =>
  command('project_update', { id, ...args });
