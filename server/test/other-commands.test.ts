import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cmd, setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { t = await setup(); });
afterEach(async () => { await t.close(); });

/** A date relative to today (UTC, the test user's timezone), so these tests do not age. */
const offsetDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const recurringDue = (days: number, string: string) => ({
  date: offsetDate(days), timezone: null, string, lang: 'en', is_recurring: true,
});

describe('completion', () => {
  it('completes a task with its subtasks and records the history', async () => {
    const first = await t.sendOk('1', [
      cmd('item_add', { content: 'Parent' }, 'tmp-p'),
      cmd('item_add', { content: 'Child', parent_id: 'tmp-p' }, 'tmp-c'),
    ]);
    const done = await t.sendOk(first.sync_token, [cmd('item_complete', { id: 'tmp-p' })]);
    expect(done.items!.every((i) => i.checked && i.completed_at)).toBe(true);
    expect((await t.sync('*')).items).toEqual([]);

    const today = new Date().toISOString().slice(0, 10);
    const history = await t.app.inject({
      method: 'GET',
      url: `/api/v1/tasks/completed/by_completion_date?since=${today}&until=${today}`,
      headers: { authorization: `Bearer ${t.token}` },
    });
    expect(history.json().items).toHaveLength(2);
  });

  it('uncompletes a task and drops its history entry', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'x' }, 'tmp-1')]);
    const id = first.temp_id_mapping!['tmp-1'];
    const done = await t.sendOk(first.sync_token, [cmd('item_complete', { id, completed_at: '2026-09-01T10:00:00Z' })]);
    const undone = await t.sendOk(done.sync_token, [cmd('item_uncomplete', { id })]);
    expect(undone.items![0]).toMatchObject({ checked: false, completed_at: null });
    expect((await t.sync('*')).items).toHaveLength(1);
    expect(await t.repo.listCompletions(t.user.id, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z', 0, 10)).toEqual([]);
  });

  it('closing a recurring task moves it on, keeps it open and records the occurrence', async () => {
    const first = await t.sendOk('1', [
      cmd('item_add', { content: 'Water plants', due: recurringDue(-5, 'every day') }, 'tmp-1'),
      cmd('item_add', { content: 'Done already', parent_id: 'tmp-1' }, 'tmp-sub'),
      cmd('item_add', { content: 'Still open', parent_id: 'tmp-1' }, 'tmp-sub2'),
    ]);
    const subDone = await t.sendOk(first.sync_token, [cmd('item_complete', { id: 'tmp-sub' })]);
    const closed = await t.sendOk(subDone.sync_token, [cmd('item_close', { id: 'tmp-1' })]);

    const item = closed.items!.find((i) => i.content === 'Water plants')!;
    // Overdue by five days: it skips to the first date after today.
    expect(item).toMatchObject({ checked: false, completed_at: null, due: recurringDue(1, 'every day') });
    // Subtasks keep their state.
    expect(closed.items!.map((i) => i.content)).toEqual(['Water plants']);
    const open = (await t.sync('*')).items!.map((i) => i.content).sort();
    expect(open).toEqual(['Still open', 'Water plants']);

    const history = await t.repo.listCompletions(t.user.id, '2000-01-01T00:00:00.000Z', '3000-01-01T00:00:00.000Z', 0, 10);
    expect(history.map((h) => h.content).sort()).toEqual(['Done already', 'Water plants']);
  });

  it('completing a recurring task archives it, as item_complete does in Todoist', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'Weekly review', due: recurringDue(3, 'every week') }, 'tmp-1')]);
    await t.sendOk(first.sync_token, [cmd('item_complete', { id: 'tmp-1' })]);
    expect((await t.sync('*')).items).toEqual([]);
  });

  it('completes the last occurrence of a series that has ended', async () => {
    const until = offsetDate(0);
    const first = await t.sendOk('1', [cmd('item_add', { content: 'Course', due: recurringDue(0, `every day until ${until}`) }, 'tmp-1')]);
    const closed = await t.sendOk(first.sync_token, [cmd('item_close', { id: 'tmp-1' })]);
    expect(closed.items![0].checked).toBe(true);
  });

  it('refuses to close a recurring task it cannot read, and keeps it', async () => {
    // Stored directly: the API would not accept this string in the first place.
    const add = await t.sendOk('1', [cmd('item_add', { content: 'Stretch' }, 'tmp-1')]);
    const id = add.temp_id_mapping!['tmp-1'];
    const stored = (await t.sync('*')).items![0];
    await t.repo.put(t.user.id, 'items', {
      ...stored, due: { ...recurringDue(0, 'every hour'), is_recurring: true },
    }, 100);
    const close = cmd('item_close', { id });
    const response = await t.send(add.sync_token, [close]);
    expect(response.sync_status![close.uuid]).toEqual({
      error_code: 30, error: 'This recurring due date is not supported: "every hour"',
    });
    expect((await t.sync('*')).items![0].due?.date).toBe(offsetDate(0));

    // It can still be moved to another date when its string is sent back unchanged.
    const move = cmd('item_update', { id, due: { date: offsetDate(4), string: 'every hour', is_recurring: true } });
    const moved = await t.send(response.sync_token, [move]);
    expect(moved.sync_status![move.uuid]).toBe('ok');
    expect(moved.items![0].due).toMatchObject({ date: offsetDate(4), string: 'every hour', is_recurring: true });
  });

  it('decides from the string whether a due date recurs', async () => {
    const response = await t.sendOk('1', [
      // The app sends the old flag along when it reschedules; a plain date does not recur.
      cmd('item_add', { content: 'A', due: { date: offsetDate(2), string: offsetDate(2), is_recurring: true } }),
      cmd('item_add', { content: 'B', due: { date: offsetDate(2), string: 'every 2 days', is_recurring: false } }),
      cmd('item_add', { content: 'C', due: { string: 'every day' } }),
    ]);
    const byContent = Object.fromEntries(response.items!.map((i) => [i.content, i.due]));
    expect(byContent.A).toMatchObject({ is_recurring: false });
    expect(byContent.B).toMatchObject({ is_recurring: true, string: 'every 2 days' });
    expect(byContent.C).toMatchObject({ is_recurring: true, date: offsetDate(0) });
  });

  it('refuses a recurring string it cannot read', async () => {
    const add = cmd('item_add', { content: 'x', due: { date: offsetDate(0), string: 'every 2nd monday' } });
    const response = await t.send('1', [add]);
    expect(response.sync_status![add.uuid]).toEqual({
      error_code: 20, error: 'This recurring due date is not supported: "every 2nd monday"',
    });
  });

  it('closes a plain task like completing it', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'x' }, 'tmp-1')]);
    const closed = await t.sendOk(first.sync_token, [cmd('item_close', { id: 'tmp-1' })]);
    expect(closed.items![0].checked).toBe(true);
  });
});

describe('projects and sections', () => {
  it('adds and updates a project', async () => {
    const first = await t.sendOk('1', [cmd('project_add', { name: 'Home', color: 'blue' }, 'tmp-p')]);
    const project = first.projects!.find((p) => p.id === first.temp_id_mapping!['tmp-p'])!;
    expect(project).toMatchObject({ name: 'Home', color: 'blue', parent_id: null, child_order: 1, is_archived: false });

    const bad = cmd('project_update', { id: project.id, name: '  ' });
    const response = await t.send(first.sync_token, [bad, cmd('project_update', { id: project.id, description: 'Chores' })]);
    expect(response.sync_status![bad.uuid]).toMatchObject({ error_code: 20 });
    expect(response.projects![0]).toMatchObject({ name: 'Home', description: 'Chores' });
  });

  it('adds a nameless section at a position, renames and reorders it', async () => {
    const first = await t.sendOk('1', [
      cmd('project_add', { name: 'Home', color: 'blue' }, 'tmp-p'),
      cmd('section_add', { name: '', project_id: 'tmp-p', section_order: 0 }, 'tmp-s'),
    ]);
    const sectionId = first.temp_id_mapping!['tmp-s'];
    expect(first.sections![0]).toMatchObject({ name: '', section_order: 0 });
    const updated = await t.sendOk(first.sync_token, [cmd('section_update', { id: 'tmp-s', name: 'Kitchen', section_order: 3 })]);
    expect(updated.sections![0]).toMatchObject({ id: sectionId, name: 'Kitchen', section_order: 3 });
  });

  it('deletes a section with the tasks still in it, keeping tasks moved out first', async () => {
    const first = await t.sendOk('1', [
      cmd('project_add', { name: 'Home', color: 'blue' }, 'p'),
      cmd('section_add', { name: 'Kitchen', project_id: 'p' }, 's'),
      cmd('item_add', { content: 'Stays', section_id: 's' }, 'a'),
      cmd('item_add', { content: 'Goes', section_id: 's' }, 'b'),
    ]);
    await t.sendOk(first.sync_token, [
      cmd('item_move', { id: 'a', project_id: 'p' }),
      cmd('section_delete', { id: 's' }),
    ]);
    const full = await t.sync('*');
    expect(full.sections).toEqual([]);
    expect(full.items!.map((i) => i.content)).toEqual(['Stays']);
  });
});

describe('labels', () => {
  it('favourites and reorders labels', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'x', labels: ['home', 'work'] }, 'tmp-1')]);
    const [home, work] = ['home', 'work'].map((n) => first.labels!.find((l) => l.name === n)!.id);
    const response = await t.sendOk(first.sync_token, [
      cmd('label_update', { id: home, is_favorite: true }),
      cmd('label_update_orders', { id_order_mapping: { [home]: 2, [work]: 1 } }),
    ]);
    const byId = Object.fromEntries(response.labels!.map((l) => [l.id, l]));
    expect(byId[home]).toMatchObject({ is_favorite: true, item_order: 2 });
    expect(byId[work]).toMatchObject({ item_order: 1 });
  });

  it('renames a label on every task and refuses a taken name', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'x', labels: ['home', 'work'] }, 'tmp-1')]);
    const home = first.labels!.find((l) => l.name === 'home')!.id;
    const clash = cmd('label_update', { id: home, name: 'Work' });
    const response = await t.send(first.sync_token, [clash, cmd('label_update', { id: home, name: 'house' })]);
    expect(response.sync_status![clash.uuid]).toMatchObject({ error_code: 20 });
    expect((await t.sync('*')).items![0].labels).toEqual(['house', 'work']);
  });

  it('does not duplicate a label used with different case', async () => {
    await t.sendOk('1', [cmd('item_add', { content: 'x', labels: ['Home'] }), cmd('item_add', { content: 'y', labels: ['home'] })]);
    expect((await t.sync('*')).labels).toHaveLength(1);
  });
});

describe('completed history endpoint', () => {
  async function completeOn(dates: string[]) {
    const adds = dates.map((_, i) => cmd('item_add', { content: `Task ${i}` }, `t${i}`));
    const first = await t.sendOk('1', adds);
    await t.sendOk(first.sync_token, dates.map((at, i) => cmd('item_complete', { id: `t${i}`, completed_at: at })));
  }
  const get = (query: string, token: string | null = t.token) => t.app.inject({
    method: 'GET',
    url: `/api/v1/tasks/completed/by_completion_date?${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

  it('returns a date range inclusively, newest first, with cursor paging', async () => {
    await completeOn(['2026-09-01T08:00:00Z', '2026-09-02T23:59:00Z', '2026-09-03T00:00:00Z', '2026-08-31T23:00:00Z']);
    const page1 = (await get('since=2026-09-01&until=2026-09-03&limit=2')).json();
    expect(page1.items.map((i: { content: string }) => i.content)).toEqual(['Task 2', 'Task 1']);
    expect(page1.next_cursor).toBe('2');
    const page2 = (await get(`since=2026-09-01&until=2026-09-03&limit=2&cursor=${page1.next_cursor}`)).json();
    expect(page2.items.map((i: { content: string }) => i.content)).toEqual(['Task 0']);
    expect(page2.next_cursor).toBeNull();
    expect(page2.items[0]).toMatchObject({ project_id: t.user.inbox_project_id, completed_at: '2026-09-01T08:00:00.000Z' });
  });

  it('validates its query and needs a token', async () => {
    expect((await get('until=2026-09-03')).statusCode).toBe(400);
    expect((await get('since=2026-09-01&until=2026-09-03&limit=0')).statusCode).toBe(400);
    expect((await get('since=2026-09-01&until=2026-09-03', null)).statusCode).toBe(401);
  });
});
