/**
 * The frontend's own API client against a running server.
 *
 * Nothing here is mocked: `sync`, `sendCommands`, `applySync` and
 * `fetchCompleted` are the functions the app ships, and they talk HTTP to the
 * server on the port vitest.config.ts puts in VITE_API_BASE.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { auth } from '@/api/auth';
import { fetchAccountConfig, signIn, signOutRemote, signUp } from '@/api/account';
import { addItem, completeItem, sendCommands, command } from '@/api/commands';
import { fetchCompleted } from '@/api/completed';
import { applySync, sync } from '@/api/sync';
import { emptySnapshot, type Snapshot } from '@/domain/types';
import { buildApp } from '../src/app';
import type { Db } from '../src/db';
import { openTestDb, uniqueEmail } from './helpers';
import { Repo } from '../src/repo';
import { createUser } from '../src/users';

const PORT = 18787;

let app: FastifyInstance;
let db: Db;
let snapshot: Snapshot;

beforeAll(async () => {
  db = await openTestDb();
  const { token } = await createUser(new Repo(db), {
    email: uniqueEmail('alice'), fullName: 'Alice Example', timezone: 'UTC',
  });
  app = await buildApp({ db });
  await app.listen({ port: PORT, host: '127.0.0.1' });
  await auth.set(token);
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('frontend client against the server', () => {
  it('connects with a full sync', async () => {
    snapshot = applySync(emptySnapshot(), await sync('*'));
    expect(snapshot.user?.inbox_project_id).toBeTruthy();
    expect(snapshot.projects[snapshot.user!.inbox_project_id].name).toBe('Inbox');
  });

  it('creates a task with a subtask, the way createTask does', async () => {
    const parent = addItem({ content: 'Buy milk', labels: ['est-15'] }, 'tmp-parent');
    const child = addItem({ content: 'Oat', parent_id: 'tmp-parent' }, 'tmp-child');
    const { response, failures } = await sendCommands(snapshot.syncToken, [parent, child]);
    expect(failures).toEqual([]);
    snapshot = applySync(snapshot, response);

    const realParent = response.temp_id_mapping!['tmp-parent'];
    expect(snapshot.items[realParent].content).toBe('Buy milk');
    expect(snapshot.items[response.temp_id_mapping!['tmp-child']].parent_id).toBe(realParent);
    // The rest of the snapshot survives a command response.
    expect(snapshot.user).not.toBeNull();
    expect(Object.keys(snapshot.projects)).toHaveLength(1);
    expect(Object.values(snapshot.labels).map((l) => l.name)).toEqual(['est-15']);
  });

  it('reports a refused command as a failure the store can show', async () => {
    const { failures } = await sendCommands(snapshot.syncToken, [command('item_update', { id: 'missing', content: 'x' })]);
    expect(failures).toEqual([{ uuid: expect.any(String), error: 'Task not found' }]);
  });

  it('drops a completed task on the next incremental sync and lists it in history', async () => {
    const id = Object.values(snapshot.items).find((i) => i.content === 'Buy milk')!.id;
    const { response } = await sendCommands(snapshot.syncToken, [completeItem(id)]);
    snapshot = applySync(snapshot, response);
    snapshot = applySync(snapshot, await sync(snapshot.syncToken));
    expect(snapshot.items[id].checked).toBe(true);

    const fresh = applySync(emptySnapshot(), await sync('*'));
    expect(fresh.items[id]).toBeUndefined();

    const now = new Date();
    const history = await fetchCompleted(new Date(now.getTime() - 60 * 86_400_000), now);
    expect(history.map((h) => h.content).sort()).toEqual(['Buy milk', 'Oat']);
  });

  it('signs up, syncs, signs out and signs back in the way the account screen does', async () => {
    const email = uniqueEmail('bob');
    expect(await fetchAccountConfig()).toEqual({ signup: true });

    const token = await signUp({ fullName: 'Bob Example', email, password: 'correct horse battery', lang: 'en' });
    await auth.set(token);
    const fresh = applySync(emptySnapshot(), await sync('*'));
    expect(fresh.user?.email).toBe(email);

    await signOutRemote(token);
    await expect(sync('*')).rejects.toMatchObject({ isAuthError: true });

    await expect(signIn(email, 'wrong password!')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(signUp({ fullName: 'Bob', email, password: 'correct horse battery', lang: 'en' }))
      .rejects.toMatchObject({ code: 'email_taken' });
    await auth.set(await signIn(email, 'correct horse battery'));
    expect(applySync(emptySnapshot(), await sync('*')).user?.email).toBe(email);
  });

  it('answers a wrong token with an auth error', async () => {
    await auth.set('x'.repeat(43));
    await expect(sync('*')).rejects.toMatchObject({ isAuthError: true });
  });
});
