import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cmd, setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { t = await setup(); });
afterEach(async () => { await t.close(); });

describe('auth', () => {
  it('answers 401 without a token or with a wrong one', async () => {
    expect((await t.post({ sync_token: '*' }, null)).statusCode).toBe(401);
    expect((await t.post({ sync_token: '*' }, 'x'.repeat(43))).statusCode).toBe(401);
  });

  it('answers bad input with 400, never 401 or 403', async () => {
    const res = await t.post({ sync_token: '*', resource_types: 'not json' });
    expect(res.statusCode).toBe(400);
  });
});

describe('read', () => {
  it('answers a full sync with every type, the user and the inbox', async () => {
    const response = await t.sync('*');
    expect(response.full_sync).toBe(true);
    expect(response.sync_token).toBe('1');
    for (const key of ['items', 'projects', 'sections', 'labels', 'notes', 'reminders', 'collaborators', 'workspaces']) {
      expect(Array.isArray((response as unknown as Record<string, unknown>)[key])).toBe(true);
    }
    expect(response.user).toMatchObject({
      id: t.user.id,
      start_day: 1,
      tz_info: { timezone: 'UTC', hours: 0, minutes: 0, is_dst: 0 },
    });
    expect(response.projects?.map((p) => p.id)).toEqual([response.user?.inbox_project_id]);
  });

  it('answers an up-to-date token with nothing', async () => {
    const response = await t.sync('1');
    expect(response.full_sync).toBe(false);
    expect(response.sync_token).toBe('1');
    expect(response.items).toEqual([]);
    expect(response.projects).toEqual([]);
    expect(response.user).toBeUndefined();
  });

  it('treats an unreadable token as a full sync', async () => {
    expect((await t.sync('garbage')).full_sync).toBe(true);
  });

  it('returns only the requested types', async () => {
    const response = await t.sync('*', ['items', 'user']);
    expect(response.items).toEqual([]);
    expect(response.user).toBeDefined();
    expect(response.projects).toBeUndefined();
  });
});

describe('commands', () => {
  it('is never a full sync, even from "*"', async () => {
    const response = await t.send('*', [cmd('item_add', { content: 'Buy milk' }, 'tmp-1')]);
    expect(response.full_sync).toBe(false);
    expect(response.items).toHaveLength(1);
  });

  it('reports an unknown command without failing the rest of the batch', async () => {
    const bad = cmd('item_teleport', {});
    const good = cmd('item_add', { content: 'Buy milk' }, 'tmp-1');
    const response = await t.send('1', [bad, good]);
    expect(response.sync_status?.[bad.uuid]).toEqual({ error_code: 10, error: 'Unknown command: item_teleport' });
    expect(response.sync_status?.[good.uuid]).toBe('ok');
  });

  it('undoes a failed command completely', async () => {
    // The labels are read and created before the invalid field is reached.
    const bad = cmd('item_add', { content: 'x', labels: ['home'], collapsed: 'yes' }, 'tmp-1');
    const response = await t.send('1', [bad]);
    expect(response.sync_status?.[bad.uuid]).toMatchObject({ error_code: 20 });
    expect(response.labels).toEqual([]);
    expect(response.temp_id_mapping).toEqual({});
  });

  it('applies a replayed uuid once and repeats its answer', async () => {
    const add = cmd('item_add', { content: 'Buy milk' }, 'tmp-1');
    const first = await t.send('1', [add]);
    const second = await t.send(first.sync_token, [add]);
    expect(second.sync_status?.[add.uuid]).toBe('ok');
    expect(second.temp_id_mapping).toEqual(first.temp_id_mapping);
    expect((await t.sync('*')).items).toHaveLength(1);
  });

  it('refuses more than 100 commands', async () => {
    const commands = Array.from({ length: 101 }, () => cmd('item_add', { content: 'x' }));
    const res = await t.post({ sync_token: '1', commands: JSON.stringify(commands) });
    expect(res.statusCode).toBe(400);
  });
});
