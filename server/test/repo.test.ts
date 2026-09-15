import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db';
import { openTestDb, uniqueEmail } from './helpers';
import { Repo } from '../src/repo';
import { createUser, tzInfo } from '../src/users';
import { hashToken } from '../src/ids';
import type { Project } from '../src/wire';

let db: Db;
let repo: Repo;

beforeEach(async () => {
  db = await openTestDb();
  repo = new Repo(db);
});
afterEach(async () => {
  await db.destroy();
});

describe('users', () => {
  it('creates a user with an inbox and finds them by token', async () => {
    const { user, token } = await createUser(repo, {
      email: uniqueEmail('alice'), fullName: 'Alice Example', timezone: 'UTC',
    });
    const found = await repo.findUserByTokenHash(hashToken(token));
    expect(found?.id).toBe(user.id);
    expect(found?.rev).toBe(1);
    const inbox = await repo.get<Project>(user.id, 'projects', user.inbox_project_id);
    expect(inbox?.inbox_project).toBe(true);
    expect(await repo.findUserByTokenHash(hashToken('wrong'))).toBeNull();
  });

  it('rejects a start day outside 1..7 and an unknown timezone', async () => {
    await expect(createUser(repo, {
      email: uniqueEmail('a'), fullName: 'A', timezone: 'UTC', startDay: 0,
    })).rejects.toThrow(RangeError);
    expect(() => tzInfo('Not/AZone')).toThrow(RangeError);
  });

  it('reads timezone offsets', () => {
    expect(tzInfo('UTC')).toMatchObject({ hours: 0, minutes: 0 });
    expect(tzInfo('Asia/Kolkata')).toMatchObject({ hours: 5, minutes: 30 });
  });
});

describe('resources', () => {
  it('stamps revisions and returns only what changed', async () => {
    const { user } = await createUser(repo, {
      email: uniqueEmail('alice'), fullName: 'Alice', timezone: 'UTC',
    });
    const rev = await repo.bumpRev(user.id);
    expect(rev).toBe(2);
    await repo.put(user.id, 'labels', { id: 'l1', name: 'home' }, rev);
    expect(await repo.changedSince(user.id, 'labels', 1)).toEqual([{ id: 'l1', name: 'home' }]);
    expect(await repo.changedSince(user.id, 'labels', 2)).toEqual([]);

    const rev3 = await repo.bumpRev(user.id);
    await repo.put(user.id, 'labels', { id: 'l1', name: 'work' }, rev3);
    expect(await repo.list(user.id, 'labels')).toEqual([{ id: 'l1', name: 'work' }]);
    expect(await repo.changedSince(user.id, 'labels', 2)).toHaveLength(1);
  });

  it('undoes a failed savepoint but keeps the rest of the transaction', async () => {
    const { user } = await createUser(repo, {
      email: uniqueEmail('alice'), fullName: 'Alice', timezone: 'UTC',
    });
    await repo.transaction(async (trx) => {
      await trx.put(user.id, 'labels', { id: 'kept' }, 5);
      await expect(trx.savepoint(async () => {
        await trx.put(user.id, 'labels', { id: 'undone' }, 5);
        throw new Error('boom');
      })).rejects.toThrow('boom');
    });
    expect((await repo.list(user.id, 'labels')).map((l) => l.id)).toEqual(['kept']);
  });

  it('keeps temp ids, applied commands and completions', async () => {
    const { user } = await createUser(repo, {
      email: uniqueEmail('alice'), fullName: 'Alice', timezone: 'UTC',
    });
    await repo.recordTempId(user.id, 'tmp', 'real');
    expect(await repo.resolveTempId(user.id, 'tmp')).toBe('real');

    await repo.recordAppliedCommand(user.id, 'u1', { error_code: 21, error: 'Task not found' });
    expect(await repo.findAppliedCommand(user.id, 'u1')).toEqual({ error_code: 21, error: 'Task not found' });
    expect(await repo.findAppliedCommand(user.id, 'u2')).toBeNull();

    const entry = (at: string) => ({
      id: 'i1', user_id: user.id, project_id: 'p', section_id: null, content: 'Buy milk', completed_at: at,
    });
    await repo.addCompletion(user.id, 'c1', entry('2026-01-01T10:00:00.000Z'));
    await repo.addCompletion(user.id, 'c2', entry('2026-01-02T10:00:00.000Z'));
    await repo.removeLatestCompletion(user.id, 'i1');
    const left = await repo.listCompletions(user.id, '2026-01-01T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 0, 10);
    expect(left.map((c) => c.completed_at)).toEqual(['2026-01-01T10:00:00.000Z']);
  });
});
