import { newId } from '../ids';
import type { Item } from '../wire';
import {
  descendants, invalidArgument, requireItem, unsupportedRecurring,
  type Args, type CommandContext, type Handler,
} from './context';

function completedAt(ctx: CommandContext, args: Args): string {
  const raw = args.completed_at ?? args.date_completed;
  if (raw === undefined) return ctx.now;
  if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) throw invalidArgument('completed_at');
  return new Date(raw).toISOString();
}

/**
 * Checks a task and its subtasks, and records each in the history Insights reads.
 *
 * A recurring task is refused: completing one should move it to its next date,
 * which this server cannot work out yet. Refusing keeps the series intact.
 */
async function complete(ctx: CommandContext, item: Item, at: string): Promise<void> {
  if (item.due?.is_recurring) throw unsupportedRecurring();
  for (const target of [item, ...(await descendants(ctx, item.id))]) {
    if (target.checked) continue;
    await ctx.repo.put(ctx.userId, 'items', {
      ...target, checked: true, completed_at: at, updated_at: ctx.now,
    }, ctx.rev);
    await ctx.repo.addCompletion(ctx.userId, newId(), {
      id: target.id,
      task_id: target.id,
      user_id: ctx.userId,
      project_id: target.project_id,
      section_id: target.section_id,
      content: target.content,
      completed_at: at,
      labels: target.labels,
      priority: target.priority,
      note_count: target.note_count ?? 0,
    });
  }
}

const itemComplete: Handler = async (ctx, args) => {
  await complete(ctx, await requireItem(ctx, args.id), completedAt(ctx, args));
};

/** For a plain task, closing is completing. */
const itemClose: Handler = async (ctx, args) => {
  await complete(ctx, await requireItem(ctx, args.id), ctx.now);
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
