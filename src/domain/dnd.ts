import { SYSTEM_LABELS, type Item } from './types';
import { toApiDate } from './dates';

/**
 * What a drop means.
 *
 * Section 7 of the specification fixes one mutation per destination. Putting
 * them in one place keeps the rules readable and stops the interface from
 * inventing its own.
 */

export type DropTarget =
  | { kind: 'today' }
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

const withoutWeek = (labels: string[]): string[] =>
  labels.filter((l) => l.toLowerCase() !== SYSTEM_LABELS.week);

const withWeek = (labels: string[]): string[] =>
  withoutWeek(labels).concat(SYSTEM_LABELS.week);

/** Builds a due value for a calendar date, preserving a time of day if one was set. */
function dueForDate(item: Item, date: Date) {
  const dateOnly = toApiDate(date);
  const time = item.due?.date.includes('T') ? item.due.date.slice(item.due.date.indexOf('T')) : '';
  return {
    date: `${dateOnly}${time}`,
    timezone: item.due?.timezone ?? null,
    string: dateOnly,
    lang: item.due?.lang ?? 'en',
    is_recurring: item.due?.is_recurring ?? false,
  };
}

export function dropMutation(item: Item, target: DropTarget): DropMutation | null {
  switch (target.kind) {
    case 'today':
      // Today's date, the week label dropped, the time of day and reminders kept.
      return { update: { due: dueForDate(item, new Date()), labels: withoutWeek(item.labels) } };

    case 'day':
      return { update: { due: dueForDate(item, target.date) } };

    case 'anytime':
      // Committed to this week, but to no particular day.
      return { update: { due: null, labels: withWeek(item.labels) } };

    case 'someday':
      return { update: { due: null, labels: withoutWeek(item.labels) } };

    case 'project':
      if (item.project_id === target.projectId) return null;
      return { move: { project_id: target.projectId } };

    case 'section':
      if (item.section_id === target.sectionId) return null;
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
  if (id === 'today' || id === 'anytime' || id === 'someday') return { kind: id };

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
