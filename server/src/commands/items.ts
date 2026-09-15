import { newId } from '../ids';
import type { Item, TodoistDeadline, TodoistDue, TodoistDuration } from '../wire';
import {
  descendants, invalidArgument, liveItems, nextOrder, requireItem, requireProject,
  requireSection, type Args, type CommandContext, type Handler,
} from './context';
import { ensureLabels, parseLabelNames } from './labels';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?$/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A due date must carry its `date`. Todoist would also parse phrases such as
 * "tomorrow"; the app always sends a worked-out date, so this server does not.
 */
export function parseDue(value: unknown): TodoistDue | null {
  if (value === null) return null;
  if (!isObject(value) || typeof value.date !== 'string'
    || !(DATE.test(value.date) || DATE_TIME.test(value.date))) {
    throw invalidArgument('due');
  }
  return {
    date: value.date,
    timezone: typeof value.timezone === 'string' ? value.timezone : null,
    string: typeof value.string === 'string' && value.string ? value.string : value.date,
    lang: typeof value.lang === 'string' ? value.lang : 'en',
    is_recurring: value.is_recurring === true,
  };
}

function parseDeadline(value: unknown): TodoistDeadline | null {
  if (value === null) return null;
  if (!isObject(value) || typeof value.date !== 'string' || !DATE.test(value.date)) {
    throw invalidArgument('deadline');
  }
  return { date: value.date, lang: typeof value.lang === 'string' ? value.lang : 'en' };
}

function parseDuration(value: unknown): TodoistDuration | null {
  if (value === null) return null;
  if (!isObject(value) || !Number.isInteger(value.amount) || (value.amount as number) <= 0
    || (value.unit !== 'minute' && value.unit !== 'day')) {
    throw invalidArgument('duration');
  }
  return { amount: value.amount as number, unit: value.unit };
}

/** The editable fields of a task. Placement (project, section, parent) is handled apart. */
async function applyFields(ctx: CommandContext, item: Item, args: Args): Promise<Item> {
  const next: Item = { ...item, updated_at: ctx.now };
  if ('content' in args) {
    if (typeof args.content !== 'string' || !args.content.trim()) throw invalidArgument('content');
    next.content = args.content;
  }
  if ('description' in args) {
    if (typeof args.description !== 'string') throw invalidArgument('description');
    next.description = args.description;
  }
  if ('priority' in args) {
    const p = args.priority;
    if (p !== 1 && p !== 2 && p !== 3 && p !== 4) throw invalidArgument('priority');
    next.priority = p;
  }
  if ('due' in args) next.due = parseDue(args.due);
  if ('deadline' in args) next.deadline = parseDeadline(args.deadline);
  if ('duration' in args) next.duration = parseDuration(args.duration);
  if ('labels' in args) {
    next.labels = parseLabelNames(args.labels);
    await ensureLabels(ctx, next.labels);
  }
  if ('collapsed' in args) {
    if (typeof args.collapsed !== 'boolean') throw invalidArgument('collapsed');
    next.collapsed = args.collapsed;
  }
  if ('responsible_uid' in args) {
    const r = args.responsible_uid;
    if (r !== null && typeof r !== 'string') throw invalidArgument('responsible_uid');
    next.responsible_uid = r;
  }
  for (const key of ['child_order', 'day_order'] as const) {
    if (key in args) {
      const value = args[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidArgument(key);
      next[key] = value;
    }
  }
  return next;
}

interface Target {
  project_id?: unknown;
  section_id?: unknown;
  parent_id?: unknown;
}

type Placement = Pick<Item, 'project_id' | 'section_id' | 'parent_id'>;

/** Where a task ends up. A parent decides everything, then a section, then a project. */
async function placement(ctx: CommandContext, target: Target): Promise<Placement> {
  if (await ctx.resolve(target.parent_id)) {
    const parent = await requireItem(ctx, target.parent_id);
    return { project_id: parent.project_id, section_id: parent.section_id, parent_id: parent.id };
  }
  if (await ctx.resolve(target.section_id)) {
    const section = await requireSection(ctx, target.section_id);
    return { project_id: section.project_id, section_id: section.id, parent_id: null };
  }
  if (await ctx.resolve(target.project_id)) {
    const project = await requireProject(ctx, target.project_id);
    return { project_id: project.id, section_id: null, parent_id: null };
  }
  throw invalidArgument('project_id');
}

async function nextChildOrder(ctx: CommandContext, item: Item): Promise<number> {
  const siblings = (await liveItems(ctx)).filter((other) =>
    other.id !== item.id
    && other.project_id === item.project_id
    && other.section_id === item.section_id
    && other.parent_id === item.parent_id);
  return nextOrder(siblings.map((s) => s.child_order));
}

/** Moves a task to the end of its new place. Its subtasks follow it. */
async function moveTo(ctx: CommandContext, item: Item, target: Target): Promise<void> {
  const place = await placement(ctx, target);
  const below = await descendants(ctx, item.id);
  if (place.parent_id && (place.parent_id === item.id || below.some((d) => d.id === place.parent_id))) {
    throw invalidArgument('parent_id');
  }

  const moved: Item = { ...item, ...place, updated_at: ctx.now };
  moved.child_order = await nextChildOrder(ctx, moved);
  await ctx.repo.put(ctx.userId, 'items', moved, ctx.rev);

  for (const child of below) {
    await ctx.repo.put(ctx.userId, 'items', {
      ...child, project_id: place.project_id, section_id: place.section_id, updated_at: ctx.now,
    }, ctx.rev);
  }
}

/** Soft-deletes a task and everything below it. */
export async function deleteItemTree(ctx: CommandContext, item: Item): Promise<void> {
  for (const target of [item, ...(await descendants(ctx, item.id))]) {
    await ctx.repo.put(ctx.userId, 'items', { ...target, is_deleted: true, updated_at: ctx.now }, ctx.rev);
  }
}

const itemAdd: Handler = async (ctx, args, tempId) => {
  if (typeof args.content !== 'string' || !args.content.trim()) throw invalidArgument('content');

  const place = await placement(ctx, {
    // The composer sends an empty project for "Inbox"; Todoist reads that as the inbox too.
    project_id: args.project_id || ctx.user.inbox_project_id,
    section_id: args.section_id,
    parent_id: args.parent_id,
  });
  const base: Item = {
    id: newId(),
    user_id: ctx.userId,
    ...place,
    content: args.content,
    description: '',
    priority: 1,
    due: null,
    deadline: null,
    duration: null,
    labels: [],
    child_order: 0,
    day_order: -1,
    collapsed: false,
    checked: false,
    is_deleted: false,
    added_at: ctx.now,
    completed_at: null,
    updated_at: ctx.now,
    responsible_uid: null,
    note_count: 0,
  };

  const item = await applyFields(ctx, base, args);
  if (!('child_order' in args)) item.child_order = await nextChildOrder(ctx, item);
  await ctx.repo.put(ctx.userId, 'items', item, ctx.rev);
  await ctx.mapTempId(tempId, item.id);
};

const itemUpdate: Handler = async (ctx, args) => {
  let item = await requireItem(ctx, args.id);
  // Todoist only moves a task through item_move, but the app's task detail
  // changes the project through item_update, so it is honoured as a move.
  if ('project_id' in args) {
    await moveTo(ctx, item, { project_id: args.project_id || ctx.user.inbox_project_id });
    item = await requireItem(ctx, item.id);
  }
  await ctx.repo.put(ctx.userId, 'items', await applyFields(ctx, item, args), ctx.rev);
};

const itemMove: Handler = async (ctx, args) => {
  const item = await requireItem(ctx, args.id);
  await moveTo(ctx, item, {
    project_id: args.project_id,
    section_id: args.section_id,
    parent_id: args.parent_id,
  });
};

const itemReorder: Handler = async (ctx, args) => {
  if (!Array.isArray(args.items)) throw invalidArgument('items');
  for (const entry of args.items as unknown[]) {
    if (!isObject(entry) || typeof entry.child_order !== 'number') throw invalidArgument('items');
    const item = await requireItem(ctx, entry.id);
    await ctx.repo.put(ctx.userId, 'items', { ...item, child_order: entry.child_order }, ctx.rev);
  }
};

const itemDelete: Handler = async (ctx, args) => {
  await deleteItemTree(ctx, await requireItem(ctx, args.id));
};

export const itemHandlers: Record<string, Handler> = {
  item_add: itemAdd,
  item_update: itemUpdate,
  item_move: itemMove,
  item_reorder: itemReorder,
  item_delete: itemDelete,
};
