import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { AccountError, signIn, signOut, signUp } from '../accounts';
import type { FailureLimiter } from '../rateLimit';
import type { Repo } from '../repo';

/**
 * Sign-up and sign-in for a self-hosted server. These routes are this
 * server's own; Todoist has no equivalent, and the app only calls them when it
 * is built for a self-hosted server.
 *
 * Every refusal carries a `code` the app can translate.
 */

const STATUS: Record<AccountError['code'], number> = {
  invalid_email: 400,
  invalid_name: 400,
  weak_password: 400,
  email_taken: 409,
  invalid_credentials: 401,
  signup_closed: 403,
};

function refuse(reply: FastifyReply, error: unknown) {
  if (!(error instanceof AccountError)) throw error;
  return reply.code(STATUS[error.code]).send({ code: error.code, error: error.message });
}

export interface AuthRouteOptions {
  repo: Repo;
  allowSignup: boolean;
  limiter: FailureLimiter;
}

export function authRoutes({ repo, allowSignup, limiter }: AuthRouteOptions): FastifyPluginAsync {
  return async (app) => {
    app.get('/config', async () => ({ signup: allowSignup }));

    app.post('/signup', async (request, reply) => {
      if (!allowSignup) {
        return refuse(reply, new AccountError('signup_closed', 'This server does not accept new accounts.'));
      }
      const body = (request.body ?? {}) as Record<string, unknown>;
      try {
        const token = await signUp(repo, {
          fullName: body.full_name,
          email: body.email,
          password: body.password,
          timezone: body.timezone,
          lang: body.lang,
        });
        return reply.code(201).send({ token });
      } catch (error) {
        return refuse(reply, error);
      }
    });

    app.post('/login', async (request, reply) => {
      const body = (request.body ?? {}) as Record<string, unknown>;
      const key = `${request.ip}|${String(body.email ?? '').trim().toLowerCase()}`;
      if (limiter.isBlocked(key)) {
        return reply.code(429).send({ code: 'rate_limited', error: 'Too many attempts. Try again later.' });
      }
      try {
        const token = await signIn(repo, body.email, body.password);
        limiter.succeed(key);
        return { token };
      } catch (error) {
        if (error instanceof AccountError) limiter.fail(key);
        return refuse(reply, error);
      }
    });

    app.post('/logout', async (request, reply) => {
      const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
      if (match) await signOut(repo, match[1]);
      // Signing out an unknown token changes nothing, so it is not an error.
      return reply.code(204).send();
    });
  };
}
