import { newId } from '../ids';
import type { Item, Label } from '../wire';
import {
  invalidArgument, liveItems, nextOrder, optionalBoolean, optionalNumber, optionalString,
  requireLabel, requireName, type CommandContext, type Handler,
} from './context';

/** A task's labels: non-blank names, each once. */
export function parseLabelNames(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
    throw invalidArgument('labels');
  }
  return [...new Set((value as string[]).map((v) => v.trim()))];
}

async function liveLabels(ctx: CommandContext): Promise<Label[]> {
  return (await ctx.repo.list<Label>(ctx.userId, 'labels')).filter((l) => !l.is_deleted);
}

/**
 * Tasks refer to labels by name. A name nobody has used before becomes a
 * label, as it does in Todoist, so estimates and tags need no setup.
 */
export async function ensureLabels(ctx: CommandContext, names: string[]): Promise<void> {
  const labels = await liveLabels(ctx);
  const known = new Set(labels.map((l) => l.name.toLowerCase()));
  let order = nextOrder(labels.map((l) => l.item_order));
  for (const name of names) {
    if (known.has(name.toLowerCase())) continue;
    known.add(name.toLowerCase());
    const label: Label = {
      id: newId(), name, color: 'charcoal', item_order: order++,
      is_deleted: false, is_favorite: false,
    };
    await ctx.repo.put(ctx.userId, 'labels', label, ctx.rev);
  }
}

const labelUpdate: Handler = async (ctx, args) => {
  const label = await requireLabel(ctx, args.id);
  const next: Label = { ...label };

  if (args.name !== undefined) {
    const name = requireName(args);
    if (name !== label.name) {
      const taken = (await liveLabels(ctx))
        .some((l) => l.id !== label.id && l.name.toLowerCase() === name.toLowerCase());
      if (taken) throw invalidArgument('name');
      // Tasks hold the name, not the id, so a rename has to reach every task.
      for (const item of await liveItems(ctx)) {
        if (!item.labels.includes(label.name)) continue;
        const renamed: Item = {
          ...item,
          labels: item.labels.map((l) => (l === label.name ? name : l)),
          updated_at: ctx.now,
        };
        await ctx.repo.put(ctx.userId, 'items', renamed, ctx.rev);
      }
      next.name = name;
    }
  }

  const color = optionalString(args, 'color');
  if (color !== undefined) next.color = color;
  const favourite = optionalBoolean(args, 'is_favorite');
  if (favourite !== undefined) next.is_favorite = favourite;
  const order = optionalNumber(args, 'item_order');
  if (order !== undefined) next.item_order = order;

  await ctx.repo.put(ctx.userId, 'labels', next, ctx.rev);
};

const labelUpdateOrders: Handler = async (ctx, args) => {
  const mapping = args.id_order_mapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    throw invalidArgument('id_order_mapping');
  }
  for (const [id, order] of Object.entries(mapping)) {
    if (typeof order !== 'number' || !Number.isFinite(order)) throw invalidArgument('id_order_mapping');
    const label = await requireLabel(ctx, id);
    await ctx.repo.put(ctx.userId, 'labels', { ...label, item_order: order }, ctx.rev);
  }
};

export const labelHandlers: Record<string, Handler> = {
  label_update: labelUpdate,
  label_update_orders: labelUpdateOrders,
};
