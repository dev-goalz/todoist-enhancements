import {
  clampedDate, daysInMonth, isWorkday, monthIndex, parts, weekStart, weekday,
} from './calendar';
import type { DateSpec, Pattern, Rule } from './parse';

/** Far more steps than any real task needs; stops a bad rule from spinning. */
const MAX_STEPS = 100_000;
const mod = (a: number, n: number) => ((a % n) + n) % n;

function nextWorkday(days: number): number {
  let d = days + 1;
  while (!isWorkday(d)) d++;
  return d;
}

/**
 * The first occurrence strictly after `after`. `anchor` is an occurrence the
 * series lines up with, so "every other week" keeps to the same weeks.
 */
export function step(pattern: Pattern, anchor: number, after: number): number {
  switch (pattern.unit) {
    case 'day': {
      const n = pattern.interval;
      return anchor + (Math.floor((after - anchor) / n) + 1) * n;
    }

    case 'workday': {
      let d = isWorkday(anchor) ? anchor : nextWorkday(anchor);
      for (let i = 0; d <= after; i++) {
        if (i > MAX_STEPS) throw new Error('Recurrence did not advance');
        for (let k = 0; k < pattern.interval; k++) d = nextWorkday(d);
      }
      return d;
    }

    case 'week': {
      if (pattern.weekdays.length === 0) return step({ unit: 'day', interval: 7 * pattern.interval }, anchor, after);
      const firstWeek = weekStart(anchor);
      for (let d = after + 1; d <= after + 7 * pattern.interval + 7; d++) {
        const inStride = mod((weekStart(d) - firstWeek) / 7, pattern.interval) === 0;
        if (inStride && pattern.weekdays.includes(weekday(d))) return d;
      }
      throw new Error('Recurrence did not advance');
    }

    case 'month': {
      const anchorParts = parts(anchor);
      const days = pattern.days.length > 0 ? pattern.days : [anchorParts.day];
      const start = parts(after);
      for (let k = 0; k < 12 * pattern.interval * 3; k++) {
        const index = monthIndex(start.year, start.month) + k;
        if (mod(index - monthIndex(anchorParts.year, anchorParts.month), pattern.interval) !== 0) continue;
        const year = Math.floor(index / 12);
        const month = (index % 12) + 1;
        const candidates = days
          .map((day) => clampedDate(year, month, day === 'last' ? daysInMonth(year, month) : day))
          .sort((a, b) => a - b);
        const found = candidates.find((c) => c > after);
        if (found !== undefined) return found;
      }
      throw new Error('Recurrence did not advance');
    }

    case 'year': {
      const anchorParts = parts(anchor);
      const dates = pattern.dates.length > 0
        ? pattern.dates
        : [{ month: anchorParts.month, day: anchorParts.day }];
      const startYear = parts(after).year;
      for (let year = startYear; year <= startYear + pattern.interval * 3; year++) {
        if (mod(year - anchorParts.year, pattern.interval) !== 0) continue;
        const candidates = dates.map((d) => clampedDate(year, d.month, d.day)).sort((a, b) => a - b);
        const found = candidates.find((c) => c > after);
        if (found !== undefined) return found;
      }
      throw new Error('Recurrence did not advance');
    }
  }
}

/** A date written without a year means its next occurrence on or after `from`. */
export function resolveDateSpec(spec: DateSpec, from: number): number {
  if (spec.year !== undefined) return clampedDate(spec.year, spec.month, spec.day);
  const { year } = parts(from);
  const thisYear = clampedDate(year, spec.month, spec.day);
  return thisYear >= from ? thisYear : clampedDate(year + 1, spec.month, spec.day);
}

/**
 * The date a recurring task moves to when it is completed, or null when the
 * series has ended.
 *
 * "every" counts from the current due date, "every!" from today. Either way
 * the result lies after today: an overdue task skips the dates it missed, as
 * Todoist does.
 */
export function nextOccurrence(rule: Rule, current: number, today: number): number | null {
  const anchor = rule.fromCompletion ? today : current;
  let next = step(rule.pattern, anchor, rule.fromCompletion ? today : current);
  for (let i = 0; next <= today; i++) {
    if (i > MAX_STEPS) throw new Error('Recurrence did not advance');
    next = step(rule.pattern, anchor, next);
  }
  if (rule.until && next > resolveDateSpec(rule.until, current)) return null;
  return next;
}

/** The first date of a new series, on or after today (or its starting date). */
export function firstOccurrence(rule: Rule, today: number): number | null {
  const from = rule.starting ? Math.max(resolveDateSpec(rule.starting, today), today) : today;
  const first = step(rule.pattern, from, from - 1);
  if (rule.until && first > resolveDateSpec(rule.until, from)) return null;
  return first;
}
