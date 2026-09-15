import {
  addDays, addMonths, addQuarters, addYears, differenceInCalendarDays,
  endOfDay, endOfMonth, endOfQuarter, endOfYear,
  startOfDay, startOfMonth, startOfQuarter, startOfYear,
} from 'date-fns';

export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/** A window of time, inclusive at both ends. */
export interface Range {
  since: Date;
  until: Date;
}

/**
 * The window a preset names, `offset` periods away from the one holding
 * `now`: 0 is this week, -1 the week before, and so on.
 *
 * Every preset is a calendar unit rather than a rolling count of days, so
 * "the previous week" is the week before this one and not the seven days
 * before the last seven. Weeks start on the day the Todoist account does.
 */
export function rangeFor(
  period: Period,
  offset: number,
  custom: Range | null,
  startDay: number,
  now = new Date(),
): Range {
  switch (period) {
    case 'day': {
      const since = startOfDay(addDays(now, offset));
      return { since, until: endOfDay(since) };
    }
    case 'week': {
      const today = startOfDay(now);
      const back = (today.getDay() - (startDay % 7) + 7) % 7;
      const since = addDays(today, -back + offset * 7);
      return { since, until: endOfDay(addDays(since, 6)) };
    }
    case 'month': {
      const at = addMonths(now, offset);
      return { since: startOfMonth(at), until: endOfMonth(at) };
    }
    case 'quarter': {
      const at = addQuarters(now, offset);
      return { since: startOfQuarter(at), until: endOfQuarter(at) };
    }
    case 'year': {
      const at = addYears(now, offset);
      return { since: startOfYear(at), until: endOfYear(at) };
    }
    case 'custom': {
      const base = custom ?? { since: startOfDay(now), until: endOfDay(now) };
      const days = spanOf(base);
      const since = startOfDay(addDays(base.since, offset * days));
      return { since, until: endOfDay(addDays(since, days - 1)) };
    }
  }
}

/** How many calendar days a range covers, never fewer than one. */
export const spanOf = (range: Range): number =>
  Math.max(1, differenceInCalendarDays(range.until, range.since) + 1);

/** The window of the same length that ends the day before this one begins. */
export function previousRange(range: Range): Range {
  const days = spanOf(range);
  const since = startOfDay(addDays(range.since, -days));
  return { since, until: endOfDay(addDays(since, days - 1)) };
}

/**
 * The range as a label: one date for a day, two for anything longer, and the
 * year only when it is not this one.
 */
export function formatRange(range: Range, intl: string, now = new Date()): string {
  const sameYear = range.since.getFullYear() === now.getFullYear()
    && range.until.getFullYear() === now.getFullYear();
  const full = new Intl.DateTimeFormat(intl, {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  });
  if (spanOf(range) === 1) return full.format(range.since);
  const sameMonth = range.since.getMonth() === range.until.getMonth()
    && range.since.getFullYear() === range.until.getFullYear();
  const first = sameMonth
    ? new Intl.DateTimeFormat(intl, { day: 'numeric' }).format(range.since)
    : full.format(range.since);
  return `${first} – ${full.format(range.until)}`;
}
