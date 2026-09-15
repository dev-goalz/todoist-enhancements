import { resolve } from 'node:path';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import type { Db } from './db';
import { hashToken } from './ids';
import { Repo } from './repo';
import { completedRoutes } from './routes/completed';
import { syncRoutes } from './routes/sync';

export interface AppOptions {
  db: Db;
  /** Comma-separated origins allowed to call the API from another host. */
  corsOrigin?: string;
  /** A built frontend (`dist/`) to serve next to the API. */
  staticDir?: string;
  logger?: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });
  const repo = new Repo(options.db);

  if (options.corsOrigin) {
    await app.register(cors, { origin: options.corsOrigin.split(',').map((o) => o.trim()) });
  }

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    // The app forgets its token on a 401 or 403, so only a failed login may use them.
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500 && status !== 401 && status !== 403) {
      return reply.code(status).send({ error: error.message });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });

  await app.register(async (api) => {
    await api.register(formbody);
    api.decorateRequest('userId', '');

    api.addHook('onRequest', async (request, reply) => {
      if (request.method === 'OPTIONS') return;
      const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
      const user = match ? await repo.findUserByTokenHash(hashToken(match[1])) : null;
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });
      request.userId = user.id;
    });

    await api.register(syncRoutes(repo));
    await api.register(completedRoutes(repo));
  }, { prefix: '/api/v1' });

  if (options.staticDir) {
    await app.register(fastifyStatic, { root: resolve(options.staticDir) });
  }

  return app;
}
