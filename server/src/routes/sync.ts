import type { FastifyPluginAsync } from 'fastify';
import { parseCommands, runCommands } from '../commands/runner';
import { parseResourceTypes, parseSyncToken, readChanges } from '../readChanges';
import type { Repo } from '../repo';

/** POST /sync: reads changes, and applies commands when the body carries any. */
export function syncRoutes(repo: Repo): FastifyPluginAsync {
  return async (app) => {
    app.post('/sync', async (request) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const since = parseSyncToken(body.sync_token);
      const types = parseResourceTypes(body.resource_types);
      const commands = body.commands === undefined ? null : parseCommands(body.commands);

      return repo.transaction(async (trx) => {
        if (!commands) return readChanges(trx, request.userId, since, types);
        const result = await runCommands(trx, request.userId, commands);
        // A write is never answered as a full sync: the app would clear every
        // collection the response does not list.
        const changes = await readChanges(trx, request.userId, since ?? 0, types);
        return { ...changes, ...result };
      });
    });
  };
}
