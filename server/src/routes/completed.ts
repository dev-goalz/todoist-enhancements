import type { FastifyPluginAsync } from 'fastify';
import { BadRequest } from '../errors';
import type { Repo } from '../repo';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * A range bound as an ISO timestamp. A plain date covers the whole day (UTC),
 * so an `until` date reaches the start of the following day.
 */
function bound(value: unknown, name: string, isEnd: boolean): string {
  if (typeof value !== 'string' || !value) throw new BadRequest(`${name} is required`);
  const at = DATE.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(at.getTime())) throw new BadRequest(`Invalid ${name}`);
  if (isEnd && DATE.test(value)) at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString();
}

/** GET /tasks/completed/by_completion_date: completion history, newest first, cursor-paged. */
export function completedRoutes(repo: Repo): FastifyPluginAsync {
  return async (app) => {
    app.get('/tasks/completed/by_completion_date', async (request) => {
      const query = request.query as Record<string, string | undefined>;
      const from = bound(query.since, 'since', false);
      const to = bound(query.until, 'until', true);

      const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new BadRequest('Invalid limit');
      const offset = query.cursor ? Number(query.cursor) : 0;
      if (!Number.isInteger(offset) || offset < 0) throw new BadRequest('Invalid cursor');

      // One row past the page says whether another page exists.
      const rows = await repo.listCompletions(request.userId, from, to, offset, limit + 1);
      return {
        items: rows.slice(0, limit),
        next_cursor: rows.length > limit ? String(offset + limit) : null,
      };
    });
  };
}
