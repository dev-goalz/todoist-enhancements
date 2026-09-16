import { SYSTEM_LABELS, weekLabel, type Bucket, type Item } from './types';
import { estimateOf } from './estimates';
import { dueDate, hasTime, isFuture, isOverdue, isToday } from './dates';

/** Case-insensitive label test, so `Week` and `week` behave the same. */
export const hasLabel = (item: Item, label: string): boolean =>
  item.labels.some((l) => l.toLowerCase() === label.toLowerCase());

export const QUICK_THRESHOLD_MINUTES = 5;

/**
 * Quick holds tasks that take under five minutes.
 *
 * The estimate is the fact and the `quick` tag is a claim: a task tagged quick
 * but estimated at forty minutes is not quick, so it stays out of the group
 * and is reported as a conflict instead. Without an estimate the tag is all
 * there is to go on.
 */
export function isQuick(item: Item): boolean {
  const est = estimateOf(item);
  if (est !== null && est > QUICK_THRESHOLD_MINUTES) return false;
  if (hasLabel(item, SYSTEM_LABELS.quick)) return true;
  return est !== null && est < QUICK_THRESHOLD_MINUTES;
}

/**
 * The single rule that decides where a task appears.
 *
 * A real date always wins over the `week` label; nothing is ever corrected
 * silently, so a task carrying both is placed by its date and separately
 * surfaces as a conflict.
 */
export function bucketOf(item: Item, now = new Date()): Bucket {
  if (item.due) {
    if (isOverdue(item, now)) return 'overdue';
    if (isToday(item, now)) return 'today';
    if (isFuture(item, now)) return 'upcoming';
  }
  return hasLabel(item, weekLabel()) ? 'anytime' : 'someday';
}

/** Tasks that are open: not completed, not deleted. */
export const isOpen = (item: Item): boolean => !item.checked && !item.is_deleted;

export interface WeekGroups {
  overdue: Item[];
  quick: Item[];
  untimed: Item[];
  timed: Item[];
  anytime: Item[];
}

/**
 * My week, assembled in the order the spec fixes: behind schedule, then quick,
 * then today without a time, then today with a time, and finally the flexible
 * "anytime this week" tasks.
 *
 * Quick absorbs today's quick tasks so none is listed twice; overdue tasks stay
 * in Behind schedule even when they are quick, because lateness is the more
 * urgent fact about them.
 */
export function groupWeek(items: Item[], now = new Date(), showQuickGroup = true): WeekGroups {
  const groups: WeekGroups = { overdue: [], quick: [], untimed: [], timed: [], anytime: [] };

  for (const item of items) {
    const bucket = bucketOf(item, now);
    if (bucket === 'overdue') {
      groups.overdue.push(item);
    } else if (bucket === 'today') {
      if (showQuickGroup && isQuick(item)) groups.quick.push(item);
      else if (hasTime(item.due)) groups.timed.push(item);
      else groups.untimed.push(item);
    } else if (bucket === 'anytime') {
      groups.anytime.push(item);
    }
  }

  const byTime = (a: Item, b: Item) =>
    (dueDate(a)?.getTime() ?? 0) - (dueDate(b)?.getTime() ?? 0);
  groups.timed.sort(byTime);
  groups.overdue.sort(byTime);

  return groups;
}

/** Everything the Upcoming view shows: strictly future dates, within a horizon. */
export function upcomingItems(items: Item[], now = new Date()): Item[] {
  return items.filter((i) => bucketOf(i, now) === 'upcoming');
}

/** Someday / backlog: no date and no `week` commitment. */
export function somedayItems(items: Item[], now = new Date()): Item[] {
  return items.filter((i) => bucketOf(i, now) === 'someday');
}

/** Anytime this week: no date, carrying `week`. */
export function anytimeItems(items: Item[], now = new Date()): Item[] {
  return items.filter((i) => bucketOf(i, now) === 'anytime');
}

/** Everything My week covers, used for the header counts and the load pill. */
export function weekItems(items: Item[], now = new Date()): Item[] {
  return items.filter((i) => {
    const b = bucketOf(i, now);
    return b === 'overdue' || b === 'today' || b === 'anytime';
  });
}
