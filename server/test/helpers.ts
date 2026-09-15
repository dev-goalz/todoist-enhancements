import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { buildApp } from '../src/app';
import { migrate, openSqlite } from '../src/db';
import { Repo } from '../src/repo';
import { createUser } from '../src/users';
import type { SyncResponse, WireCommand } from '../src/wire';

/** A fresh in-memory server with one user, and shortcuts for talking to it. */
export async function setup() {
  const db = openSqlite(':memory:');
  await migrate(db);
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
