import { BadRequest } from '../errors';
import type { Repo } from '../repo';
import type { CommandStatus, WireCommand } from '../wire';
import { CommandError, unknownCommand, type CommandContext } from './context';
import { HANDLERS } from './index';

/** Todoist accepts at most 100 commands in one call; so does this server. */
export const MAX_COMMANDS = 100;

export function parseCommands(raw: unknown): WireCommand[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequest('commands must be a JSON array');
    }
  }
  if (!Array.isArray(parsed)) throw new BadRequest('commands must be a JSON array');
  if (parsed.length > MAX_COMMANDS) throw new BadRequest(`At most ${MAX_COMMANDS} commands per call`);
  for (const entry of parsed) {
    const c = entry as Partial<WireCommand> | null;
    if (
      !c || typeof c.type !== 'string' || typeof c.uuid !== 'string' || !c.uuid
      || (c.args !== undefined && (typeof c.args !== 'object' || c.args === null))
      || (c.temp_id !== undefined && typeof c.temp_id !== 'string')
    ) {
      throw new BadRequest('Each command needs a type, a uuid and an args object');
    }
  }
  return (parsed as WireCommand[]).map((c) => ({ ...c, args: c.args ?? {} }));
}

/**
 * Applies a batch. Must run inside a transaction.
 *
 * Each command gets its own savepoint, so one that fails leaves no partial
 * writes and does not stop the others, which is how Todoist reports a batch.
 * A uuid already seen is not applied again: the app replays its offline
 * queue, and a retry must not create a second task.
 */
export async function runCommands(
  repo: Repo,
  userId: string,
  commands: WireCommand[],
): Promise<{ sync_status: Record<string, CommandStatus>; temp_id_mapping: Record<string, string> }> {
  const user = (await repo.getUser(userId)).data;
  const rev = await repo.bumpRev(userId);
  const tempIdMapping: Record<string, string> = {};
  const syncStatus: Record<string, CommandStatus> = {};
  let pending: Record<string, string> = {};

  const ctx: CommandContext = {
    repo,
    userId,
    user,
    rev,
    now: new Date().toISOString(),
    async resolve(id) {
      if (id === null || id === undefined || id === '') return null;
      if (typeof id !== 'string') throw new CommandError(20, 'Invalid argument value: id');
      return pending[id] ?? tempIdMapping[id] ?? (await repo.resolveTempId(userId, id)) ?? id;
    },
    async mapTempId(tempId, realId) {
      if (!tempId) return;
      pending[tempId] = realId;
      await repo.recordTempId(userId, tempId, realId);
    },
  };

  for (const command of commands) {
    const previous = await repo.findAppliedCommand(userId, command.uuid);
    if (previous) {
      syncStatus[command.uuid] = previous;
      if (command.temp_id) {
        const real = await repo.resolveTempId(userId, command.temp_id);
        if (real) tempIdMapping[command.temp_id] = real;
      }
      continue;
    }

    let status: CommandStatus = 'ok';
    pending = {};
    try {
      const handler = HANDLERS[command.type];
      if (!handler) throw unknownCommand(command.type);
      await repo.savepoint(() => handler(ctx, command.args, command.temp_id));
      Object.assign(tempIdMapping, pending);
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      status = { error_code: error.code, error: error.message };
    }
    pending = {};
    await repo.recordAppliedCommand(userId, command.uuid, status);
    syncStatus[command.uuid] = status;
  }

  return { sync_status: syncStatus, temp_id_mapping: tempIdMapping };
}
