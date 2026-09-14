import {
  addDays, differenceInCalendarDays, endOfWeek, format, isSameDay,
  parseISO, startOfDay, startOfWeek,
} from 'date-fns';
import type { Item, TodoistDue } from './types';

/** True when the due value carries a time of day, not just a calendar date. */
export const hasTime = (due: TodoistDue | null): boolean =>
  !!due && due.date.includes('T');

/** The due moment as a local Date, or null. */
export function dueDate(item: Item): Date | null {
  if (!item.due) return null;
  // A date-only value must be read as local midnight, never as UTC, or it
  // lands on the previous day for anyone west of Greenwich.
  return item.due.date.includes('T') ? parseISO(item.due.date) : startOfDay(parseISO(item.due.date));
}

export function deadlineDate(item: Item): Date | null {
  if (!item.deadline) return null;
  return startOfDay(parseISO(item.deadline.date));
}

export const isOverdue = (item: Item, now = new Date()): boolean => {
  const d = dueDate(item);
  if (!d) return false;
  return hasTime(item.due) ? d.getTime() < now.getTime() : d < startOfDay(now);
};

export const isToday = (item: Item, now = new Date()): boolean => {
  const d = dueDate(item);
  return !!d && isSameDay(d, now);
};

export const isFuture = (item: Item, now = new Date()): boolean => {
  const d = dueDate(item);
  return !!d && startOfDay(d) > startOfDay(now);
};

/** The API wants a plain calendar date for date-only changes. */
export const toApiDate = (d: Date): string => format(d, 'yyyy-MM-dd');
/** And a floating local datetime when a time of day is kept. */
export const toApiDateTime = (d: Date): string => format(d, "yyyy-MM-dd'T'HH:mm:ss");

export interface WeekBounds { start: Date; end: Date }

/** The user's week, honouring the start_day they set in Todoist (1 = Monday). */
export function weekBounds(now: Date, startDay: number): WeekBounds {
  const weekStartsOn = (startDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  return {
    start: startOfWeek(now, { weekStartsOn }),
    end: endOfWeek(now, { weekStartsOn }),
  };
}

/** Inclusive list of days between two dates. */
export function daysBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const span = differenceInCalendarDays(to, from);
  for (let i = 0; i <= span; i += 1) out.push(startOfDay(addDays(from, i)));
  return out;
}

/** "Today", "Tomorrow", "Mon 14", "14 Sep" depending on how far away it is. */
export function formatRelativeDay(
  date: Date,
  locale: 'en' | 'fr',
  now = new Date(),
): string {
  const diff = differenceInCalendarDays(startOfDay(date), startOfDay(now));
  const strings = {
    en: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' },
    fr: { today: "Aujourd'hui", tomorrow: 'Demain', yesterday: 'Hier' },
  }[locale];

  if (diff === 0) return strings.today;
  if (diff === 1) return strings.tomorrow;
  if (diff === -1) return strings.yesterday;

  const intl = locale === 'fr' ? 'fr-FR' : 'en-GB';
  // Inside the coming week a weekday name reads faster than a number.
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat(intl, { weekday: 'short' }).format(date);
  }
  return new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'short' }).format(date);
}

export function formatTime(date: Date, locale: 'en' | 'fr', hour12: boolean): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  }).format(date);
}

/** "3d" / "1d" — how long a task has been late, for the overdue markers. */
export function overdueBy(item: Item, now = new Date()): number {
  const d = dueDate(item);
  if (!d) return 0;
  return Math.max(0, differenceInCalendarDays(startOfDay(now), startOfDay(d)));
}
