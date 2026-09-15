import type { TodoistDue } from '../wire';
import { fromDays, localParts, toDays, zonedToUtc } from './calendar';
import { firstOccurrence, nextOccurrence } from './occurrences';
import { parseRecurrence, type ParseResult, type Rule } from './parse';

export { parseRecurrence };
export type { ParseResult, Rule };

/**
 * A due date's three shapes, as the API defines them: a plain date
 * ("2026-09-15"), a floating time ("2026-09-15T09:00:00"), or a time fixed to
 * a timezone ("2026-09-15T07:00:00Z" with `timezone` set).
 */
interface DueShape {
  kind: 'date' | 'floating' | 'fixed';
  /** The local calendar date. */
  date: string;
  /** Everything after the date in a floating value, e.g. "T09:00:00.000000". */
  floatingSuffix?: string;
  /** The local wall-clock time of a fixed value. */
  localTime?: string;
  /** Fractional seconds as written, kept when the value is rewritten. */
  fraction?: string;
}

function readShape(due: TodoistDue, userTimezone: string): DueShape {
  if (!due.date.includes('T')) return { kind: 'date', date: due.date };
  if (!due.date.endsWith('Z')) {
    return { kind: 'floating', date: due.date.slice(0, 10), floatingSuffix: due.date.slice(10) };
  }
  const local = localParts(Date.parse(due.date), due.timezone ?? userTimezone);
  const fraction = /(\.\d+)Z$/.exec(due.date)?.[1] ?? '';
  return { kind: 'fixed', date: local.date, localTime: local.time, fraction };
}

function writeDate(shape: DueShape, date: string, ruleTime: string | undefined, timezone: string): string {
  switch (shape.kind) {
    case 'date':
      // A plain date gains a time only when the string names one.
      return ruleTime ? `${date}T${ruleTime}` : date;
    case 'floating':
      return `${date}${shape.floatingSuffix}`;
    case 'fixed': {
      const instant = new Date(zonedToUtc(date, shape.localTime!, timezone)).toISOString();
      return `${instant.slice(0, 19)}${shape.fraction}Z`;
    }
  }
}

export class UnsupportedRecurrence extends Error {
  constructor(readonly dueString: string) {
    super(`This recurring due date is not supported: "${dueString}"`);
  }
}

const today = (timezone: string, now: Date) => toDays(localParts(now.getTime(), timezone).date);

function readRule(string: string, lang: string): Rule {
  const parsed = parseRecurrence(string, lang);
  if (parsed.kind !== 'recurring') throw new UnsupportedRecurrence(string);
  return parsed.rule;
}

/**
 * The due date a recurring task moves to when it is closed, or null when its
 * series has ended. The string is kept as it is; only the date moves.
 */
export function rollForward(due: TodoistDue, userTimezone: string, now: Date): TodoistDue | null {
  const rule = readRule(due.string, due.lang);
  const timezone = due.timezone ?? userTimezone;
  const shape = readShape(due, userTimezone);
  const next = nextOccurrence(rule, toDays(shape.date), today(userTimezone, now));
  if (next === null) return null;
  return { ...due, date: writeDate(shape, fromDays(next), rule.time, timezone) };
}

/** The first due date of a recurring string given without a date, or null if it has already ended. */
export function firstDueDate(string: string, lang: string, userTimezone: string, now: Date): string | null {
  const rule = readRule(string, lang);
  const first = firstOccurrence(rule, today(userTimezone, now));
  if (first === null) return null;
  return rule.time ? `${fromDays(first)}T${rule.time}` : fromDays(first);
}
