import { SYSTEM_LABELS, weekLabel, type Item } from './types';
import { toApiDate } from './dates';
import { dueForDate } from './recurrence';

/**
 * What a drop means.
 *
 * Section 7 of the specification fixes one mutation per destination. Putting
 * them in one place keeps the rules readable and stops the interface from
 * inventing its own.
 */

export type DropTarget =
  | { kind: 'today' }
  /** Today, and tagged quick: the Quick group is defined by that tag. */
  | { kind: 'quick' }
  | { kind: 'anytime' }
  | { kind: 'someday' }
  | { kind: 'day'; date: Date }
  | { kind: 'project'; projectId: string }
  | { kind: 'section'; sectionId: string | null; projectId: string }
  | { kind: 'label'; label: string };

export interface DropMutation {
  /** Fields for an `item_update` command, when the drop changes the task itself. */
  update?: Record<string, unknown>;
  /** Fields for an `item_move` command, when the drop changes where it lives. */
  move?: { project_id?: string; section_id?: string | null };
}

/**
 * Todoist's `item_move` takes exactly one destination. A section implies its
 * project, so the section is sent when there is one and the project otherwise.
 */
export function moveArgs(
  move: { project_id?: string; section_id?: string | null },
): { section_id: string } | { project_id?: string } {
  return move.section_id ? { section_id: move.section_id } : { project_id: move.project_id };
}

const withoutWeek = (labels: string[]): string[] =>
  labels.filter((l) => l.toLowerCase() !== weekLabel().toLowerCase());

const withWeek = (labels: string[]): string[] =>
  withoutWeek(labels).concat(weekLabel());

/**
 * A due value for a calendar date.
 *
 * The one in domain/recurrence, because dropping a repeating task onto a day
 * is the commonest way to end a series by accident: it used to write the date
 * into `due.string` while leaving `is_recurring` true, which leaves a task
 * wearing a repeat marker that will never repeat again.
 */
const dueOn = (item: Item, date: Date) => dueForDate(item.due, toApiDate(date));

export function dropMutation(item: Item, target: DropTarget): DropMutation | null {
  switch (target.kind) {
    case 'today':
      // Today's date, the week label dropped, the time of day and reminders kept.
      return { update: { due: dueOn(item, new Date()), labels: withoutWeek(item.labels) } };

    case 'quick': {
      const labels = withoutWeek(item.labels);
      const tagged = labels.some((l) => l.toLowerCase() === SYSTEM_LABELS.quick);
      return {
        update: {
          due: dueOn(item, new Date()),
          labels: tagged ? labels : [...labels, SYSTEM_LABELS.quick],
        },
      };
    }

    case 'day':
      /* A real date and the week tag on the same task is the contradiction the
         app reports rather than resolves, so giving a task a day takes the tag
         off — exactly as dropping it on Today does. */
      return { update: { due: dueOn(item, target.date), labels: withoutWeek(item.labels) } };

    case 'anytime':
      // Committed to this week, but to no particular day.
      return { update: { due: null, labels: withWeek(item.labels) } };

    case 'someday':
      return { update: { due: null, labels: withoutWeek(item.labels) } };

    /* A subtask dropped on the place it already lives in is lifted out of its
       parent, so the same list it came from is still a real destination. */
    case 'project':
      if (item.project_id === target.projectId && !item.parent_id) return null;
      return { move: { project_id: target.projectId } };

    case 'section':
      if (item.section_id === target.sectionId && !item.parent_id) return null;
      return { move: { project_id: target.projectId, section_id: target.sectionId } };

    case 'label': {
      // A tag is added to whatever the task already carries; it never replaces.
      const already = item.labels.some((l) => l.toLowerCase() === target.label.toLowerCase());
      if (already) return null;
      return { update: { labels: [...item.labels, target.label] } };
    }

    default:
      return null;
  }
}

/**
 * The droppable id of a task row that accepts another task as its subtask.
 *
 * Kept apart from `DropTarget`: nesting is not a destination with a mutation
 * of its own but a change of parent, and it needs the parent row to find the
 * project and section the task follows it into.
 */
const NEST_PREFIX = 'nest:';
export const nestTargetId = (itemId: string): string => `${NEST_PREFIX}${itemId}`;
export const decodeNestTarget = (id: string): string | null =>
  id.startsWith(NEST_PREFIX) ? id.slice(NEST_PREFIX.length) : null;

/**
 * How many levels of subtasks Todoist keeps under a task. It refuses a move
 * that would go deeper, and the row would jump back on the next sync.
 */
export const MAX_SUBTASK_DEPTH = 4;

/** How many parents a task has above it. */
function depthOf(items: Record<string, Item>, id: string): number {
  let depth = 0;
  for (let at = items[id]; at?.parent_id; at = items[at.parent_id]) depth += 1;
  return depth;
}

/** How many levels of open subtasks hang below a task; 0 for none. */
function heightOf(items: Record<string, Item>, id: string): number {
  let height = 0;
  for (const other of Object.values(items)) {
    if (other.parent_id === id && !other.is_deleted) {
      height = Math.max(height, 1 + heightOf(items, other.id));
    }
  }
  return height;
}

/**
 * Whether a task may go inside another one: not inside itself, not inside
 * something already below it, not where it already is, and not so deep that
 * it or its own subtasks would pass the limit.
 */
export function canNest(items: Record<string, Item>, itemId: string, parentId: string): boolean {
  const item = items[itemId];
  const parent = items[parentId];
  if (!item || !parent || item.parent_id === parentId) return false;
  for (let at: Item | undefined = parent; at; at = at.parent_id ? items[at.parent_id] : undefined) {
    if (at.id === itemId) return false;
  }
  return depthOf(items, parentId) + 1 + heightOf(items, itemId) <= MAX_SUBTASK_DEPTH;
}

/**
 * Encodes a target as a droppable id, and reads it back.
 *
 * Two places can offer the same destination — the sidebar's "My week" and the
 * page's "Anytime this week" are both `anytime` — and a droppable registry is
 * keyed by id, so without a scope the second registration silently replaces
 * the first and one of the two stops accepting drops.
 */
export function encodeTarget(target: DropTarget, scope?: string): string {
  const id = encodeKind(target);
  return scope ? `${scope}|${id}` : id;
}

function encodeKind(target: DropTarget): string {
  switch (target.kind) {
    case 'day': return `day:${toApiDate(target.date)}`;
    case 'project': return `project:${target.projectId}`;
    case 'section': return `section:${target.projectId}:${target.sectionId ?? ''}`;
    case 'label': return `label:${target.label}`;
    default: return target.kind;
  }
}

export function decodeTarget(encoded: string): DropTarget | null {
  const id = encoded.includes('|') ? encoded.slice(encoded.indexOf('|') + 1) : encoded;
  if (id === 'today' || id === 'quick' || id === 'anytime' || id === 'someday') return { kind: id };

  const [kind, ...rest] = id.split(':');
  if (kind === 'day') {
    const date = new Date(`${rest[0]}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : { kind: 'day', date };
  }
  if (kind === 'project') return { kind: 'project', projectId: rest[0] };
  if (kind === 'section') {
    return { kind: 'section', projectId: rest[0], sectionId: rest[1] || null };
  }
  if (kind === 'label') return { kind: 'label', label: rest.join(':') };
  return null;
}
