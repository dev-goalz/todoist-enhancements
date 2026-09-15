import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetPassword } from '../src/accounts';
import { buildApp } from '../src/app';
import { migrate, type Database } from '../src/db';
import { hashPassword, verifyPassword } from '../src/passwords';
import { FailureLimiter } from '../src/rateLimit';
import { Repo } from '../src/repo';
import type { SyncResponse } from '../src/wire';
import { openTestDb, uniqueEmail } from './helpers';

type Ctx = Awaited<ReturnType<typeof makeServer>>;

async function makeServer(options: { allowSignup?: boolean; limiter?: FailureLimiter } = {}) {
  const db = await openTestDb();
  const app = await buildApp({ db, ...options });
  const json = (method: 'GET' | 'POST', url: string, payload?: unknown, token?: string) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const sync = (token: string) => app.inject({
    method: 'POST',
    url: '/api/v1/sync',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'sync_token=*&resource_types=%5B%22all%22%5D',
  });
  return { db, app, repo: new Repo(db), json, sync, close: async () => { await app.close(); await db.destroy(); } };
}

let s: Ctx;
beforeEach(async () => { s = await makeServer(); });
afterEach(async () => { await s.close(); });

const account = () => ({
  full_name: 'Alice Example',
  email: uniqueEmail('alice'),
  password: 'correct horse battery',
  timezone: 'Europe/Amsterdam',
  lang: 'nl',
});

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword('correct horse battery', a)).toBe(true);
    expect(await verifyPassword('wrong horse battery', a)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});

describe('sign-up', () => {
  it('creates an account with an inbox and hands out a working token', async () => {
    const input = account();
    const res = await s.json('POST', '/auth/signup', input);
    expect(res.statusCode).toBe(201);
    const { token } = res.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const synced = (await s.sync(token)).json() as SyncResponse;
    expect(synced.user).toMatchObject({
      email: input.email, full_name: 'Alice Example', lang: 'nl',
      tz_info: { timezone: 'Europe/Amsterdam' },
    });
    expect(synced.projects?.map((p) => p.name)).toEqual(['Inbox']);
  });

  it('refuses bad input with a code the app can translate', async () => {
    const cases: Array<[Record<string, unknown>, number, string]> = [
      [{ ...account(), email: 'not-an-email' }, 400, 'invalid_email'],
      [{ ...account(), full_name: '  ' }, 400, 'invalid_name'],
      [{ ...account(), password: 'short' }, 400, 'weak_password'],
    ];
    for (const [body, status, code] of cases) {
      const res = await s.json('POST', '/auth/signup', body);
      expect(res.statusCode, code).toBe(status);
      expect(res.json().code).toBe(code);
    }
  });

  it('refuses an email that is taken, whatever its case', async () => {
    const input = account();
    await s.json('POST', '/auth/signup', input);
    const again = await s.json('POST', '/auth/signup', { ...input, email: input.email.toUpperCase() });
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe('email_taken');
  });

  it('falls back to UTC for an unknown timezone', async () => {
    const { token } = (await s.json('POST', '/auth/signup', { ...account(), timezone: 'Mars/Olympus' })).json();
    expect(((await s.sync(token)).json() as SyncResponse).user?.tz_info.timezone).toBe('UTC');
  });

  it('can be closed', async () => {
    const closed = await makeServer({ allowSignup: false });
    try {
      expect((await closed.json('GET', '/auth/config')).json()).toEqual({ signup: false });
      const res = await closed.json('POST', '/auth/signup', account());
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('signup_closed');
    } finally {
      await closed.close();
    }
    expect((await s.json('GET', '/auth/config')).json()).toEqual({ signup: true });
  });
});

describe('sign-in and sign-out', () => {
  it('gives each device its own token and signs out only that one', async () => {
    const input = account();
    const first = (await s.json('POST', '/auth/signup', input)).json().token;
    const login = await s.json('POST', '/auth/login', { email: ` ${input.email.toUpperCase()} `, password: input.password });
    expect(login.statusCode).toBe(200);
    const second = login.json().token;
    expect(second).not.toBe(first);

    expect((await s.json('POST', '/auth/logout', undefined, first)).statusCode).toBe(204);
    expect((await s.sync(first)).statusCode).toBe(401);
    expect((await s.sync(second)).statusCode).toBe(200);
  });

  it('answers a wrong password and an unknown email the same way', async () => {
    const input = account();
    await s.json('POST', '/auth/signup', input);
    const wrong = await s.json('POST', '/auth/login', { email: input.email, password: 'wrong password!' });
    const unknown = await s.json('POST', '/auth/login', { email: uniqueEmail('nobody'), password: input.password });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().code).toBe('invalid_credentials');
  });

  it('does not let an account without a password sign in', async () => {
    const { createUser } = await import('../src/users');
    const email = uniqueEmail('cli');
    await createUser(s.repo, { email, fullName: 'Cli User', timezone: 'UTC' });
    expect((await s.json('POST', '/auth/login', { email, password: '' })).statusCode).toBe(401);
  });

  it('stops listening after repeated failures, per email', async () => {
    let now = 0;
    const limited = await makeServer({ limiter: new FailureLimiter(3, 60_000, () => now) });
    try {
      const input = account();
      await limited.json('POST', '/auth/signup', input);
      for (let i = 0; i < 3; i++) {
        expect((await limited.json('POST', '/auth/login', { email: input.email, password: 'wrong password!' })).statusCode).toBe(401);
      }
      const blocked = await limited.json('POST', '/auth/login', input);
      expect(blocked.statusCode).toBe(429);
      expect(blocked.json().code).toBe('rate_limited');
      // Another email from the same address is unaffected.
      expect((await limited.json('POST', '/auth/login', { email: uniqueEmail('bob'), password: 'x' })).statusCode).toBe(401);
      now += 60_001;
      expect((await limited.json('POST', '/auth/login', input)).statusCode).toBe(200);
    } finally {
      await limited.close();
    }
  });

  it('resets a password and signs the account out everywhere', async () => {
    const input = account();
    const token = (await s.json('POST', '/auth/signup', input)).json().token;
    const password = await resetPassword(s.repo, input.email);
    expect(password).toMatch(/^[A-Za-z0-9_-]{20}$/);
    expect((await s.sync(token)).statusCode).toBe(401);
    expect((await s.json('POST', '/auth/login', input)).statusCode).toBe(401);
    expect((await s.json('POST', '/auth/login', { email: input.email, password })).statusCode).toBe(200);
    expect(await resetPassword(s.repo, uniqueEmail('nobody'))).toBeNull();
  });
});

describe('migration from a database made before accounts', () => {
  it('keeps existing tokens working and fills in emails once', async () => {
    const db = new Kysely<Database>({ dialect: new SqliteDialect({ database: new SQLite(':memory:') }) });
    try {
      // The users table as the first release created it.
      await db.schema.createTable('users')
        .addColumn('id', 'text', (c) => c.primaryKey())
        .addColumn('token_hash', 'text', (c) => c.notNull().unique())
        .addColumn('rev', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('user_rev', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('data', 'text', (c) => c.notNull())
        .execute();
      const { hashToken } = await import('../src/ids');
      const old = (id: string, token: string, email: string) => ({
        id, token_hash: hashToken(token), rev: 1, user_rev: 1,
        data: JSON.stringify({ id, email, full_name: id, inbox_project_id: 'p', tz_info: {}, start_day: 1 }),
      });
      await (db as Kysely<any>).insertInto('users').values([
        old('u1', 'token-one-aaaaaaaaaaaaaaaa', 'Alice@Example.com'),
        old('u2', 'token-two-bbbbbbbbbbbbbbbb', 'alice@example.com'),
      ]).execute();

      await migrate(db);
      await migrate(db); // a second start changes nothing

      const repo = new Repo(db);
      expect((await repo.findUserByTokenHash(hashToken('token-one-aaaaaaaaaaaaaaaa')))?.id).toBe('u1');
      expect((await repo.findUserByTokenHash(hashToken('token-two-bbbbbbbbbbbbbbbb')))?.id).toBe('u2');
      expect((await repo.findUserByEmail('alice@example.com'))?.id).toBe('u1');
    } finally {
      await db.destroy();
    }
  });
});
