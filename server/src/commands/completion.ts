import { newId } from '../ids';
import { rollForward, UnsupportedRecurrence } from '../recurrence';
import type { Item } from '../wire';
import {
  CommandError, descendants, invalidArgument, requireItem,
  type Args, type CommandContext, type Handler,
} from './context';

function completedAt(ctx: CommandContext, args: Args): string {
  const raw = args.completed_at ?? args.date_completed;
  if (raw === undefined) return ctx.now;
  if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) throw invalidArgument('completed_at');
  return new Date(raw).toISOString();
}

/** One entry in the history Insights reads. */
async function recordCompletion(ctx: CommandContext, item: Item, at: string): Promise<void> {
  await ctx.repo.addCompletion(ctx.userId, newId(), {
    id: item.id,
    task_id: item.id,
    user_id: ctx.userId,
    project_id: item.project_id,
    section_id: item.section_id,
    content: item.content,
    completed_at: at,
    labels: item.labels,
    priority: item.priority,
    note_count: item.note_count ?? 0,
  });
}

/** Checks a task and its subtasks for good, recurring or not. */
async function complete(ctx: CommandContext, item: Item, at: string): Promise<void> {
  for (const target of [item, ...(await descendants(ctx, item.id))]) {
    if (target.checked) continue;
    await ctx.repo.put(ctx.userId, 'items', {
      ...target, checked: true, completed_at: at, updated_at: ctx.now,
    }, ctx.rev);
    await recordCompletion(ctx, target, at);
  }
}

/**
 * item_complete archives the task, a recurring one included; moving a series
 * on is item_close's job. This is how the Todoist API defines the two.
 */
const itemComplete: Handler = async (ctx, args) => {
  await complete(ctx, await requireItem(ctx, args.id), completedAt(ctx, args));
};

/**
 * What closing a task does in Todoist's own apps: a plain task is completed, a
 * recurring one moves to its next date and stays open. The occurrence is still
 * recorded as a completion. Subtasks keep their state, as they do in Todoist
 * unless a client asks for them to be reset.
 */
const itemClose: Handler = async (ctx, args) => {
  const item = await requireItem(ctx, args.id);
  if (!item.due?.is_recurring) {
    await complete(ctx, item, ctx.now);
    return;
  }

  let next;
  try {
    next = rollForward(item.due, ctx.user.tz_info.timezone, new Date(ctx.now));
  } catch (error) {
    if (error instanceof UnsupportedRecurrence) throw new CommandError(30, error.message);
    throw error;
  }
  if (next === null) {
    // The series has ended, so this was its last occurrence.
    await complete(ctx, item, ctx.now);
    return;
  }

  await ctx.repo.put(ctx.userId, 'items', { ...item, due: next, updated_at: ctx.now }, ctx.rev);
  await recordCompletion(ctx, item, ctx.now);
};

const itemUncomplete: Handler = async (ctx, args) => {
  const item = await requireItem(ctx, args.id);
  if (!item.checked) return;
  await ctx.repo.put(ctx.userId, 'items', {
    ...item, checked: false, completed_at: null, updated_at: ctx.now,
  }, ctx.rev);
  await ctx.repo.removeLatestCompletion(ctx.userId, item.id);
};

export const completionHandlers: Record<string, Handler> = {
  item_complete: itemComplete,
  item_close: itemClose,
  item_uncomplete: itemUncomplete,
};
