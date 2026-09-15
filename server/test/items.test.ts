import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Item } from '../src/wire';
import { cmd, setup } from './helpers';

let t: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { t = await setup(); });
afterEach(async () => { await t.close(); });

const itemsById = async () =>
  Object.fromEntries(((await t.sync('*')).items ?? []).map((i) => [i.id, i])) as Record<string, Item>;

async function addProjectWithSection() {
  const response = await t.sendOk('1', [
    cmd('project_add', { name: 'Home', color: 'blue' }, 'tmp-p'),
    cmd('section_add', { name: 'Kitchen', project_id: 'tmp-p' }, 'tmp-s'),
  ]);
  return { projectId: response.temp_id_mapping!['tmp-p'], sectionId: response.temp_id_mapping!['tmp-s'] };
}

describe('item_add', () => {
  it('puts a task in the inbox by default and maps its temp id', async () => {
    const response = await t.sendOk('1', [cmd('item_add', { content: 'Buy milk', labels: ['home', 'est-15'] }, 'tmp-1')]);
    const id = response.temp_id_mapping!['tmp-1'];
    expect(id).toMatch(/^[A-Za-z0-9]{16}$/);
    const item = response.items!.find((i) => i.id === id)!;
    expect(item).toMatchObject({
      content: 'Buy milk', project_id: t.user.inbox_project_id, section_id: null,
      parent_id: null, priority: 1, checked: false, is_deleted: false, child_order: 1,
    });
    expect(response.labels!.map((l) => l.name).sort()).toEqual(['est-15', 'home']);
  });

  it('reads an empty project_id as the inbox', async () => {
    const response = await t.sendOk('1', [cmd('item_add', { content: 'Buy milk', project_id: '' }, 'tmp-1')]);
    expect(response.items![0].project_id).toBe(t.user.inbox_project_id);
  });

  it('creates subtasks pointing at a parent temp id in the same batch', async () => {
    const { sectionId } = await addProjectWithSection();
    const response = await t.sendOk('2', [
      cmd('item_add', { content: 'Clean', section_id: sectionId }, 'tmp-parent'),
      cmd('item_add', { content: 'Fridge', parent_id: 'tmp-parent' }, 'tmp-child'),
    ]);
    const items = await itemsById();
    const parent = items[response.temp_id_mapping!['tmp-parent']];
    const child = items[response.temp_id_mapping!['tmp-child']];
    expect(parent.section_id).toBe(sectionId);
    expect(child).toMatchObject({ parent_id: parent.id, section_id: sectionId, project_id: parent.project_id });
  });

  it('accepts a temp id from an earlier batch', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'Buy milk' }, 'tmp-1')]);
    await t.sendOk(first.sync_token, [cmd('item_update', { id: 'tmp-1', content: 'Buy oat milk' })]);
    expect(Object.values(await itemsById())[0].content).toBe('Buy oat milk');
  });

  it('keeps the fields the composer sends', async () => {
    const due = { date: '2026-09-20', timezone: null, string: '2026-09-20', lang: 'en', is_recurring: false };
    const response = await t.sendOk('1', [cmd('item_add', {
      content: 'Plan week', description: 'notes', priority: 4, due, deadline: { date: '2026-09-25', lang: 'en' },
    }, 'tmp-1')]);
    expect(response.items![0]).toMatchObject({
      description: 'notes', priority: 4, due, deadline: { date: '2026-09-25', lang: 'en' },
    });
  });

  it('refuses a missing project', async () => {
    const add = cmd('item_add', { content: 'x', project_id: 'nope' });
    const response = await t.send('1', [add]);
    expect(response.sync_status![add.uuid]).toEqual({ error_code: 21, error: 'Project not found' });
  });
});

describe('item_update', () => {
  it('changes fields and refuses bad values without touching the task', async () => {
    const first = await t.sendOk('1', [cmd('item_add', { content: 'Buy milk' }, 'tmp-1')]);
    const id = first.temp_id_mapping!['tmp-1'];
    const bad = cmd('item_update', { id, content: 'changed', priority: 9 });
    const response = await t.send(first.sync_token, [bad]);
    expect(response.sync_status![bad.uuid]).toMatchObject({ error_code: 20 });
    expect((await itemsById())[id].content).toBe('Buy milk');

    await t.sendOk(response.sync_token, [cmd('item_update', { id, priority: 3, due: null, labels: ['quick'] })]);
    expect((await itemsById())[id]).toMatchObject({ priority: 3, due: null, labels: ['quick'] });
  });

  it('moves a task when project_id is sent', async () => {
    const { projectId, sectionId } = await addProjectWithSection();
    const first = await t.sendOk('2', [cmd('item_add', { content: 'Buy milk', section_id: sectionId }, 'tmp-1')]);
    const id = first.temp_id_mapping!['tmp-1'];
    await t.sendOk(first.sync_token, [cmd('item_update', { id, project_id: t.user.inbox_project_id })]);
    expect((await itemsById())[id]).toMatchObject({ project_id: t.user.inbox_project_id, section_id: null });
    expect(projectId).toBeTruthy();
  });
});

describe('item_move and item_reorder', () => {
  it('moves a task and its subtasks into a section', async () => {
    const { projectId, sectionId } = await addProjectWithSection();
    const first = await t.sendOk('2', [
      cmd('item_add', { content: 'Parent' }, 'tmp-p'),
      cmd('item_add', { content: 'Child', parent_id: 'tmp-p' }, 'tmp-c'),
    ]);
    const parentId = first.temp_id_mapping!['tmp-p'];
    const childId = first.temp_id_mapping!['tmp-c'];
    const moved = await t.sendOk(first.sync_token, [cmd('item_move', { id: parentId, section_id: sectionId })]);
    expect(moved.items!.map((i) => i.id).sort()).toEqual([parentId, childId].sort());
    const items = await itemsById();
    expect(items[parentId]).toMatchObject({ project_id: projectId, section_id: sectionId, parent_id: null });
    expect(items[childId]).toMatchObject({ project_id: projectId, section_id: sectionId, parent_id: parentId });
  });

  it('moves to a project root when section_id is null', async () => {
    const { projectId, sectionId } = await addProjectWithSection();
    const first = await t.sendOk('2', [cmd('item_add', { content: 'x', section_id: sectionId }, 'tmp-1')]);
    const id = first.temp_id_mapping!['tmp-1'];
    await t.sendOk(first.sync_token, [cmd('item_move', { id, project_id: projectId, section_id: null })]);
    expect((await itemsById())[id]).toMatchObject({ project_id: projectId, section_id: null });
  });

  it('refuses to make a task its own descendant', async () => {
    const first = await t.sendOk('1', [
      cmd('item_add', { content: 'Parent' }, 'tmp-p'),
      cmd('item_add', { content: 'Child', parent_id: 'tmp-p' }, 'tmp-c'),
    ]);
    const move = cmd('item_move', { id: first.temp_id_mapping!['tmp-p'], parent_id: first.temp_id_mapping!['tmp-c'] });
    const response = await t.send(first.sync_token, [move]);
    expect(response.sync_status![move.uuid]).toMatchObject({ error_code: 20 });
  });

  it('reorders tasks', async () => {
    const first = await t.sendOk('1', [
      cmd('item_add', { content: 'A' }, 'a'),
      cmd('item_add', { content: 'B' }, 'b'),
    ]);
    const a = first.temp_id_mapping!.a;
    const b = first.temp_id_mapping!.b;
    await t.sendOk(first.sync_token, [cmd('item_reorder', { items: [{ id: a, child_order: 2 }, { id: b, child_order: 1 }] })]);
    const items = await itemsById();
    expect([items[a].child_order, items[b].child_order]).toEqual([2, 1]);
  });
});

describe('item_delete', () => {
  it('deletes subtasks too; incremental sync reports it, full sync drops it', async () => {
    const first = await t.sendOk('1', [
      cmd('item_add', { content: 'Parent' }, 'tmp-p'),
      cmd('item_add', { content: 'Child', parent_id: 'tmp-p' }, 'tmp-c'),
    ]);
    const deleted = await t.sendOk(first.sync_token, [cmd('item_delete', { id: 'tmp-p' })]);
    expect(deleted.items!.every((i) => i.is_deleted)).toBe(true);
    expect(deleted.items).toHaveLength(2);
    expect((await t.sync('*')).items).toEqual([]);
  });
});
