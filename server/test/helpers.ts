import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { buildApp } from '../src/app';
import { migrate, openDatabase, openSqlite, type Db } from '../src/db';
import { Repo } from '../src/repo';
import { createUser } from '../src/users';
import type { SyncResponse, WireCommand } from '../src/wire';

/**
 * The database tests run on: in-memory SQLite, or Postgres when
 * TEST_DATABASE_URL is set. Every test creates its own user, and all data is
 * scoped by user, so tests sharing one Postgres database do not see each other.
 */
export async function openTestDb(): Promise<Db> {
  const url = process.env.TEST_DATABASE_URL;
  const db = url ? openDatabase(url) : openSqlite(':memory:');
  await migrate(db);
  return db;
}

/** A fresh server with one user, and shortcuts for talking to it. */
export async function setup() {
  const db = await openTestDb();
  const repo = new Repo(db);
  const { user, token } = await createUser(repo, {
    email: 'alice@example.com',
    fullName: 'Alice Example',
    timezone: 'UTC',
  });
  const app = await buildApp({ db });

  const post = (form: Record<string, string>, authToken: string | null = token) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      payload: new URLSearchParams(form).toString(),
    });

  const sync = async (syncToken = '*', resourceTypes: string[] = ['all']) => {
    const res = await post({ sync_token: syncToken, resource_types: JSON.stringify(resourceTypes) });
    expect(res.statusCode).toBe(200);
    return res.json() as SyncResponse;
  };

  const send = async (
    syncToken: string,
    commands: WireCommand[],
    resourceTypes: string[] = ['items', 'projects', 'sections', 'labels', 'notes'],
  ) => {
    const res = await post({
      sync_token: syncToken,
      resource_types: JSON.stringify(resourceTypes),
      commands: JSON.stringify(commands),
    });
    expect(res.statusCode).toBe(200);
    return res.json() as SyncResponse;
  };

  /** Sends commands, fails the test unless every one came back "ok". */
  const sendOk = async (syncToken: string, commands: WireCommand[]) => {
    const response = await send(syncToken, commands);
    for (const command of commands) expect(response.sync_status?.[command.uuid]).toBe('ok');
    return response;
  };

  const close = async () => {
    await app.close();
    await db.destroy();
  };

  return { app, db, repo, user, token, post, sync, send, sendOk, close };
}

export const cmd = (type: string, args: Record<string, unknown>, tempId?: string): WireCommand => ({
  type,
  uuid: randomUUID(),
  args,
  ...(tempId ? { temp_id: tempId } : {}),
});
