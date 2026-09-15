import type { Repo } from '../repo';
import type { Item, Label, Project, Section, TodoistUser } from '../wire';

/** A command the server understood but will not apply. Reported in `sync_status`. */
export class CommandError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

export const unknownCommand = (type: string) => new CommandError(10, `Unknown command: ${type}`);
export const invalidArgument = (name: string) => new CommandError(20, `Invalid argument value: ${name}`);
export const notFound = (what: string) => new CommandError(21, `${what} not found`);
export const unsupportedRecurring = () =>
  new CommandError(30, 'Recurring tasks are not supported by this server yet');

export interface CommandContext {
  readonly repo: Repo;
  readonly userId: string;
  readonly user: TodoistUser;
  /** The revision every write in this batch carries. */
  readonly rev: number;
  /** One timestamp for the whole batch. */
  readonly now: string;
  /** Turns a temp id (from this batch or an earlier one) into the real id. Real ids pass through. */
  resolve(id: unknown): Promise<string | null>;
  /** Records the real id created for a command's temp id. */
  mapTempId(tempId: string | undefined, realId: string): Promise<void>;
}

export type Args = Record<string, unknown>;
export type Handler = (ctx: CommandContext, args: Args, tempId?: string) => Promise<void>;

/* ---------- Arguments ---------- */

export function optionalString(args: Args, key: string): string | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw invalidArgument(key);
  return value;
}

export function optionalBoolean(args: Args, key: string): boolean | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw invalidArgument(key);
  return value;
}

export function optionalNumber(args: Args, key: string): number | undefined {
  const value = args[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidArgument(key);
  return value;
}

/** A name that must not be blank. */
export function requireName(args: Args, key = 'name'): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw invalidArgument(key);
  return value.trim();
}

/** One past the highest order, so a new entry lands at the end. */
export function nextOrder(orders: number[]): number {
  return orders.reduce((max, order) => Math.max(max, order), 0) + 1;
}

/* ---------- Lookups ---------- */

async function requireLive<T extends { id: string; is_deleted: boolean }>(
  ctx: CommandContext,
  type: 'items' | 'projects' | 'sections' | 'labels',
  rawId: unknown,
  what: string,
): Promise<T> {
  const id = await ctx.resolve(rawId);
  if (!id) throw invalidArgument('id');
  const row = await ctx.repo.get<T>(ctx.userId, type, id);
  if (!row || row.is_deleted) throw notFound(what);
  return row;
}

export const requireItem = (ctx: CommandContext, id: unknown) =>
  requireLive<Item>(ctx, 'items', id, 'Task');
export const requireProject = (ctx: CommandContext, id: unknown) =>
  requireLive<Project>(ctx, 'projects', id, 'Project');
export const requireSection = (ctx: CommandContext, id: unknown) =>
  requireLive<Section>(ctx, 'sections', id, 'Section');
export const requireLabel = (ctx: CommandContext, id: unknown) =>
  requireLive<Label>(ctx, 'labels', id, 'Label');

export async function liveItems(ctx: CommandContext): Promise<Item[]> {
  return (await ctx.repo.list<Item>(ctx.userId, 'items')).filter((item) => !item.is_deleted);
}

/** Every subtask below a task, at any depth. */
export async function descendants(ctx: CommandContext, id: string): Promise<Item[]> {
  const byParent = new Map<string, Item[]>();
  for (const item of await liveItems(ctx)) {
    if (!item.parent_id) continue;
    const siblings = byParent.get(item.parent_id) ?? [];
    siblings.push(item);
    byParent.set(item.parent_id, siblings);
  }
  const out: Item[] = [];
  const stack = [id];
  while (stack.length > 0) {
    for (const child of byParent.get(stack.pop()!) ?? []) {
      out.push(child);
      stack.push(child.id);
    }
  }
  return out;
}
